const { Connection, PublicKey } = require("@solana/web3.js");
const { getOrca, OrcaFarmConfig, OrcaPoolConfig } = require("@orca-so/sdk")
const { SolendAction, SolendMarket } = require("@solendprotocol/solend-sdk");


const { google } = require("googleapis");

const appendSheet = (rows) => {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const spreadsheetId = process.env.SPREADSHEET_ID
  return google.auth.getClient({
          scopes
      })
      .then(auth => {
          const sheets = google.sheets('v4');
          return sheets.spreadsheets.values.append({
              auth,
              spreadsheetId,
              range: "Sheet1!A2",
              valueInputOption: "RAW",
              insertDataOption: "INSERT_ROWS",
              resource: {
                  values: rows
              }
          });
      })
}


const getOrcaData = async () => {
  const rpcEndpoint = process.env.NODERPC_ENDPOINT
  const ownerPubkey = process.env.OWNER_PUBKEY

  const connection = new Connection(rpcEndpoint, "singleGossip");

  const orca = getOrca(connection);
  const pubkey = new PublicKey(ownerPubkey)

  const solUsdcAq = orca.getFarm(OrcaFarmConfig.SOL_USDC_AQ)
  const solUsdcPool = orca.getPool(OrcaPoolConfig.SOL_USDC)

  const promises = []
  promises.push(solUsdcAq.getHarvestableAmount(pubkey));
  promises.push(solUsdcAq.getFarmBalance(pubkey));
  return Promise.all(promises).then(([unclaimedOrca, farmBalance]) => {
    return solUsdcAq.getFarmBalance(pubkey).then(farmBalance => {
      const withdrawTokenMint = solUsdcPool.getPoolTokenMint();
      return solUsdcPool.getWithdrawQuote(
        farmBalance,
        withdrawTokenMint
      ).then(res => {
          const now = new Date();

          return {
              timestamp: now, maxPoolTokenAmountIn: res.maxPoolTokenAmountIn.toNumber(), minTokenAOut: res.minTokenAOut.toNumber(), minTokenBOut: res.minTokenBOut.toNumber(), constantProduct: res.minTokenAOut.toNumber() * res.minTokenBOut.toNumber(), unclaimedOrca: unclaimedOrca.toNumber(),
          }
    })
    }).catch(console.error)
  })
}

exports.main = async () => {
    return getOrcaData().then(data => {
        appendSheet([[data.timestamp, data.maxPoolTokenAmountIn, data.minTokenAOut, data.minTokenBOut, data.constantProduct, data.unclaimedOrca]]).then(console.log)
    })
};
