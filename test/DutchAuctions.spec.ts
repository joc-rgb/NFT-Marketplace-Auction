
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
let dutchContract: any;

const name = 'Non Fungible Token';
const symbol = 'NFT';
const firstTokenId = '5042';
const secondTokenId = '79217';

describe('Test DutchAuctions', function () {
  
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
      
    // compile dutchContract
    const compiledContract = await vite.compile('DutchAuctions.solpp');
    expect(compiledContract).to.have.property('DutchAuctions');
    dutchContract = compiledContract.DutchAuctions;
    // deploy dutchContract
    dutchContract.setDeployer(deployer).setProvider(provider);
    await dutchContract.deploy({params: [], responseLatency: 1});
    expect(dutchContract.address).to.be.a('string');
    
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

  describe('Dutch Auction', function () {
    before(async function () {
      //approve DutchAuctions
      await nftContract.call('approve', [dutchContract.address, firstTokenId], {caller: charlie});
      await nftContract.call('approve', [dutchContract.address, secondTokenId], {caller: charlie});
    });

    it('create dutch auction', async function () {
      let startTime = Math.round(new Date().getTime()/1000);
      let endTime = startTime+500
      await dutchContract.call('createAuction', [
        startTime,
        endTime,
        100,
        30,
        5,
        nftContract.address,
        firstTokenId,
      ], { caller: charlie });
      await nftContract.waitForHeight(8);

      //get auction info 1 by 1
      expect(await nftContract.query('balanceOf', [charlie.address])).to.be.deep.equal(['1']);
      expect(await dutchContract.query('getTotalAuction')).to.be.deep.equal(['1']);
      expect(await dutchContract.query('getStartPrice', [0])).to.be.deep.equal(['100']);
      expect(await dutchContract.query('getReservedPrice', [0])).to.be.deep.equal(['30']);
      expect(await dutchContract.query('getdecreaseRate', [0])).to.be.deep.equal(['5']);
      expect(await dutchContract.query('getCreator', [0])).to.be.deep.equal([charlie.address]);
      expect(await dutchContract.query('getNftAddress', [0])).to.be.deep.equal([nftContract.address]);
      expect(await dutchContract.query('getTokenId', [0])).to.be.deep.equal([firstTokenId]);
      expect(await nftContract.query('balanceOf', [charlie.address])).to.be.deep.equal(['1']);
      expect(await dutchContract.query('getStartTime', [0])).to.be.deep.equal([startTime.toString()]);
      expect(await dutchContract.query('getEndTime', [0])).to.be.deep.equal([endTime.toString()]);
      expect(await dutchContract.query('getCurrentPrice', [0, Math.round(new Date().getTime() / 1000)])).to.be.deep.equal(['100']);
      
      //read full auction info
      expect(await dutchContract.query('getAuctionInfo', [0])).to.be.deep.equal([
        startTime.toString(),endTime.toString(),'100','30','5',charlie.address,nftContract.address,firstTokenId,'0','vite_0000000000000000000000000000000000000000a4f3a0cb58','0']
      );
    });
    
     it('bid a dutch auction', async function () {
      await dutchContract.call('placeBid', [0], { amount: "20", caller: alice });
      expect(await alice.balance()).to.be.equal('980');
      await dutchContract.call('placeBid', [0], { amount: "25", caller: bob });
      await alice.receiveAll();
      expect(await bob.balance()).to.be.deep.equal('975');
      expect(await alice.balance()).to.be.equal('1000');
      expect(await dutchContract.query('getAllBids', [0])).to.be.deep.equal([[alice.address,bob.address], ['20','25']]);
      expect(await dutchContract.query('getHighestBid', [0])).to.be.deep.equal(['25']);
      expect(await dutchContract.query('getHighestBidder', [0])).to.be.deep.equal([bob.address]);
    });

    it('cancel a dutch auction', async function () {
      await dutchContract.call('cancelAuction', [0], { caller: charlie });
      await bob.receiveAll();
      expect(await bob.balance()).to.be.deep.equal('1000');
      expect(await dutchContract.query('getIsCancelled', [0])).to.be.deep.equal(['1']);
      await nftContract.waitForHeight(9);
      expect(await nftContract.query('balanceOf', [charlie.address])).to.be.deep.equal(['2']);
    });

    it('fail to cancel a dutch auction when highest bid exceed reserved price', async function () {
      let startTime = Math.round(new Date().getTime()/1000);
      let endTime = startTime+500
      await dutchContract.call('createAuction', [
        startTime,
        endTime,
        50,
        30,
        10,
        nftContract.address,
        secondTokenId,
      ], { caller: charlie });
      
      await dutchContract.call('placeBid', [1], { amount: "35", caller: alice });
      await expect(dutchContract.call('cancelAuction', [1], { caller: charlie })).to.eventually.be.rejectedWith("revert");
      expect(await dutchContract.query('getIsCancelled', [1])).to.be.deep.equal(['0']);
      await nftContract.waitForHeight(8);
      expect(await nftContract.query('balanceOf', [charlie.address])).to.be.deep.equal(['1']);
      
    });

    it('paging all ongoing and ended auctions', async function () {
      expect(await dutchContract.query('getAuctionPaging', [0, 2])).to.be.deep.equal([
        ["0", "1"],'2'
        
      ]);
    });
  });
});