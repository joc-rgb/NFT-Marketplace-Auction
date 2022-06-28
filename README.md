# Grants Round 14 Hackathon - NFT Marketplace Contracts

## English auction (highest bidder pays their bid)
Can have a reserve price for if the highest bid is accepted or not</br>
## Dutch auction (price descends until someone buys)
Can have a reserve price for when the auction is canceled</br>

## Process

1. A user approves an auction contract to transfer the NFT(s) they would like to sell</br>
2. The user specifies which NFT to auction off and includes the auction parameters (e.g. starting price, reserve price, expiration date, minimum bid increase for English auctions, price decrease rate for Dutch auctions, date after which the seller can no longer cancel their auction, etc.)</br>
3. The auction contract transfers that NFT to itself and hold it in escrow while the auction is ongoing</br>
4. Other users bid on the auction</br>
5. In the case of English auctions, new highest bids are held in escrow while the last highest bid is sent back to its bidder.</br>
6. Once the auction has ended, the NFT and funds from the winning bid are transferred to their rightful owner</br>

## Contract details

### Create auction with parameter info</br>
Set auction starting price, reserved price, startTime, endTime, minIncrease/decreaseRate✅</br>
NFT is transferred and kept in contract address✅</br>

### Bid auction
Bid auction with price higher than previous bid✅</br>
Fund is transferred and stored in contract✅</br>
Previous highest bid is returned back to the bidder✅</br>

### Claim fund and NFT after auction ended
Fund is claimed by auction creator✅</br>
NFT is claimed by highest bidder✅</br>

### Cancel auction
Cancel auction if reserved price not reached✅</br>
NFT is transferred back to auction creator✅</br>
Highest bid is returned back to the bidder✅</br>

### Reading/Paginating through all ongoing and ended auctions
Get Auction addresses by specify size and count✅</br>

### Get Full Parameter Info of Auction
Read full info of auction in 1 function✅</br>
