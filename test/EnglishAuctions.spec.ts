import { describe } from "mocha";
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;
const vite = require('@vite/vuilder');
import config from "./vite.config.json";

let provider: any;
let deployer: any;
let alice: any;
let bob: any;
let charlie: any;
let nftContract: any;
let englishContract: any;

const name = 'Non Fungible Token';
const symbol = 'NFT';
const firstTokenId = '5042';
const secondTokenId = '79217';

describe('Test EnglishAuctions', function () {
  
  before(async function () {
    provider = vite.newProvider("http://127.0.0.1:23456");
    // init users
    deployer = vite.newAccount(config.networks.local.mnemonic, 0, provider);
    alice = vite.newAccount(config.networks.local.mnemonic, 1, provider);
    bob = vite.newAccount(config.networks.local.mnemonic, 2, provider);
    charlie = vite.newAccount(config.networks.local.mnemonic, 3, provider);
    await deployer.sendToken(alice.address, '1000');
    await alice.receiveAll();
    await deployer.sendToken(bob.address, '1000');
    await bob.receiveAll();
    await deployer.sendToken(charlie.address, '1000');
    await charlie.receiveAll();
      
    // compile NFT
    const compiledNFTContract = await vite.compile('NFT.solpp');
    expect(compiledNFTContract).to.have.property('NFT');
    nftContract = compiledNFTContract.NFT;
    // deploy NFT
    nftContract.setDeployer(deployer).setProvider(provider);
    await nftContract.deploy({params: [name, symbol], responseLatency: 1});
    expect(nftContract.address).to.be.a('string');
    //mint NFT
    await nftContract.call('mint', [deployer.address, firstTokenId], {});
    await nftContract.call('mint', [deployer.address, secondTokenId], {});
      
    // compile englishContract
    const compiledContract = await vite.compile('EnglishAuctions.solpp');
    expect(compiledContract).to.have.property('EnglishAuctions');
    englishContract = compiledContract.EnglishAuctions;
    // deploy englishContract
    englishContract.setDeployer(deployer).setProvider(provider);
    await englishContract.deploy({params: [], responseLatency: 1});
    expect(englishContract.address).to.be.a('string');
    
  });

  describe('balanceOf NFT', function () {
    context('when the given address does not own any tokens', function () {
      it('returns the amount of tokens owned by the given address', async function () {
        expect(await nftContract.query('balanceOf', [deployer.address])).to.be.deep.equal(['2']);
      });
    });

    context('when the given address does not own any tokens', function () {
      it('returns 0', async function () {
        expect(await nftContract.query('balanceOf', [alice.address])).to.be.deep.equal(['0']);
      });
    });
  });

  describe('transfers NFT', function () {
    it('owner transfers the ownership of firstToken and secondToken to the given address', async function () {
      await nftContract.call('transferFrom', [deployer.address, charlie.address, firstTokenId], {caller: deployer});
      await nftContract.call('transferFrom', [deployer.address, charlie.address, secondTokenId], {caller: deployer});
      expect(await nftContract.query('balanceOf', [charlie.address])).to.be.deep.equal(['2']);
    });
  });

  describe('English Auction', function () {
    before(async function () {
      //approve englishAuctions
      await nftContract.call('approve', [englishContract.address, firstTokenId], {caller: charlie});
      await nftContract.call('approve', [englishContract.address, secondTokenId], {caller: charlie});
    });

    it('create english auction', async function () {
      let startTime = Math.round(new Date().getTime()/1000);
      let endTime = startTime+700
      await englishContract.call('createAuction', [
        startTime,
        endTime,
        50,
        400,
        5,
        nftContract.address,
        firstTokenId,
      ], { caller: charlie });
      await nftContract.waitForHeight(8);
      expect(await nftContract.query('balanceOf', [charlie.address])).to.be.deep.equal(['1']);
      expect(await englishContract.query('getTotalAuction')).to.be.deep.equal(['1']);
      expect(await englishContract.query('getStartPrice', [0])).to.be.deep.equal(['50']);
      expect(await englishContract.query('getReservedPrice', [0])).to.be.deep.equal(['400']);
      expect(await englishContract.query('getminIncrement', [0])).to.be.deep.equal(['5']);
      expect(await englishContract.query('getCreator', [0])).to.be.deep.equal([charlie.address]);
      expect(await englishContract.query('getNftAddress', [0])).to.be.deep.equal([nftContract.address]);
      expect(await englishContract.query('getTokenId', [0])).to.be.deep.equal([firstTokenId]);
      expect(await nftContract.query('balanceOf', [charlie.address])).to.be.deep.equal(['1']);
      expect(await englishContract.query('getStartTime', [0])).to.be.deep.equal([startTime.toString()]);
      expect(await englishContract.query('getEndTime', [0])).to.be.deep.equal([endTime.toString()]);
      
      //read full auction info
      expect(await englishContract.query('getAuctionInfo', [0])).to.be.deep.equal([
        startTime.toString(),endTime.toString(),'50','400','5',charlie.address,nftContract.address,firstTokenId,'0','vite_0000000000000000000000000000000000000000a4f3a0cb58','0']
      );
    });
    

    it('bid a english auction', async function () {
      await englishContract.call('placeBid', [0], { amount: "60", caller: alice });
      expect(await alice.balance()).to.be.equal('1905');
      await englishContract.call('placeBid', [0], { amount: "70", caller: bob });
      await alice.receiveAll();
      expect(await bob.balance()).to.be.deep.equal('1930');
      expect(await alice.balance()).to.be.equal('1965');
      expect(await englishContract.query('getAllBids', [0])).to.be.deep.equal([[alice.address,bob.address], ['60','70']]);
      expect(await englishContract.query('getHighestBid', [0])).to.be.deep.equal(['70']);
      expect(await englishContract.query('getHighestBidder', [0])).to.be.deep.equal([bob.address]);
    });

    it('cancel a english auction', async function () {
      await englishContract.call('cancelAuction', [0], { caller: charlie });
      await bob.receiveAll();
      expect(await bob.balance()).to.be.deep.equal('2000');
      expect(await englishContract.query('getIsCancelled', [0])).to.be.deep.equal(['1']);
      await nftContract.waitForHeight(9);
      expect(await nftContract.query('balanceOf', [charlie.address])).to.be.deep.equal(['2']);
    });

    it('fail to cancel a english auction when highest bid exceed reserved price', async function () {
      let startTime = Math.round(new Date().getTime()/1000);
      let endTime = startTime+700
      await englishContract.call('createAuction', [
        startTime,
        endTime,
        40,
        50,
        10,
        nftContract.address,
        secondTokenId,
      ], { caller: charlie });
      
      await englishContract.call('placeBid', [1], { amount: "60", caller: alice });
      await expect(englishContract.call('cancelAuction', [1], { caller: charlie })).to.eventually.be.rejectedWith("revert");
      expect(await englishContract.query('getIsCancelled', [1])).to.be.deep.equal(['0']);
      await nftContract.waitForHeight(8);
      expect(await nftContract.query('balanceOf', [charlie.address])).to.be.deep.equal(['1']);
      
    });

    it('paging all ongoing and ended auctions', async function () {
      expect(await englishContract.query('getAuctionPaging', [0, 2])).to.be.deep.equal([
        ["0", "1"],'2'
        
      ]);
    });
  });
});