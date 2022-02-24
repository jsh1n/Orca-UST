import { Connection, PublicKey } from "@solana/web3.js";
import { getOrca, OrcaFarmConfig, OrcaPoolConfig } from "@orca-so/sdk";
import Decimal from "decimal.js";
import * as dotenv from "dotenv";

dotenv.config()

const main = async () => {
  const rpcEndpoint = process.env.NODERPC_ENDPOINT
  const apiKey = process.env.NODERPC_API_KEY
  const ownerPubkey = process.env.OWNER_PUBKEY
  const url = `${rpcEndpoint}?api_key=${apiKey}`
  console.log(url)
  const connection = new Connection(url, "singleGossip");

  const orca = getOrca(connection);
  const pubkey = new PublicKey(ownerPubkey)

  const solUsdcAq = orca.getFarm(OrcaFarmConfig.SOL_USDC_AQ)
  const solUsdcPool = orca.getPool(OrcaPoolConfig.SOL_USDC)

  const farmBalance = await solUsdcAq.getFarmBalance(pubkey);
  const unclaimedBalance = await solUsdcAq.getHarvestableAmount(pubkey)
  console.log(`Farm Token Balance: ${farmBalance.toNumber()}`)
  console.log(`Unclaimed Balance: ${unclaimedBalance.toNumber()}`)

  const withdrawTokenMint = solUsdcPool.getPoolTokenMint();
  const { maxPoolTokenAmountIn, minTokenAOut, minTokenBOut } = await solUsdcPool.getWithdrawQuote(
    farmBalance,
    withdrawTokenMint
  );

  console.log(
    `Withdraw at most ${maxPoolTokenAmountIn.toNumber()} SOL_USDC LP token for at least ${minTokenAOut.toNumber()} SOL and ${minTokenBOut.toNumber()} USDC`
  );
};

main()
  .then(() => {
    console.log("Done");
  })
  .catch((e) => {
    console.error(e);
  });
