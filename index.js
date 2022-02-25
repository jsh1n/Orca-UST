const dotenv = require("dotenv");

const { Connection, PublicKey } = require("@solana/web3.js");
const { getOrca, OrcaFarmConfig, OrcaPoolConfig } = require("@orca-so/sdk");

const { google } = require("googleapis");


dotenv.config()


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


const getOrcaData = () => {
  const rpcEndpoint = process.env.NODERPC_ENDPOINT
  const apiKey = process.env.NODERPC_API_KEY
  const ownerPubkey = process.env.OWNER_PUBKEY

  const url = `${rpcEndpoint}?api_key=${apiKey}`
  const connection = new Connection(url, "singleGossip");

  const orca = getOrca(connection);
  const pubkey = new PublicKey(ownerPubkey)

  const solUsdcAq = orca.getFarm(OrcaFarmConfig.SOL_USDC_AQ)
  const solUsdcPool = orca.getPool(OrcaPoolConfig.SOL_USDC)

  return solUsdcAq.getFarmBalance(pubkey).then(farmBalance => {
    const withdrawTokenMint = solUsdcPool.getPoolTokenMint();
    return solUsdcPool.getWithdrawQuote(
      farmBalance,
      withdrawTokenMint
    ).then(res => {
        const now = new Date();

        return {
            timestamp: now, maxPoolTokenAmountIn: res.maxPoolTokenAmountIn.toNumber(), minTokenAOut: res.minTokenAOut.toNumber(), minTokenBOut: res.minTokenBOut.toNumber(), constantProduct: res.minTokenAOut.toNumber() * res.minTokenBOut.toNumber()
        }
    }).catch(console.error)
  })
}

exports.main = async () => {
    return getOrcaData().then(data => {
        appendSheet([[data.timestamp, data.maxPoolTokenAmountIn, data.minTokenAOut, data.minTokenBOut, data.constantProduct]]).then(console.log)
    })
};
