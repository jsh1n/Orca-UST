const { Connection, PublicKey } = require("@solana/web3.js");
const { TokenListProvider, TokenInfo } = require("@solana/spl-token-registry");
const { getOrca, OrcaFarmConfig, OrcaPoolConfig } = require("@orca-so/sdk")
const { SolendMarket } = require("@solendprotocol/solend-sdk");

const { google } = require("googleapis");

const rpcEndpoint = process.env.NODERPC_ENDPOINT
const ownerPubkey = process.env.OWNER_PUBKEY

const appendSheet = (range, rows) => {
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
              range,
              valueInputOption: "RAW",
              insertDataOption: "INSERT_ROWS",
              resource: {
                  values: rows
              }
          });
      })
}



const getSolendData = async (conn, pubkey) => {
  const market = await SolendMarket.initialize(
    conn,
    'production'
  );
  const obligation = await market.fetchObligationByWallet(pubkey);

  const tokensMap = new Map();
  const tokenList = await new TokenListProvider().resolve().then((tokens) => {
      const tokenList = tokens.filterByClusterSlug('mainnet-beta').getList();
      return tokenList.forEach(t => tokensMap.set(t.address, t))
  })

  const deposits = obligation.deposits.map((d) => {
      const s = d.amount.toString()
      const tokenInfo = tokensMap.get(d.mintAddress)
      const balance = s.slice(0, s.length-tokenInfo.decimals) + '.' + s.slice(s.length - tokenInfo.decimals)
      return {
        symbol: tokenInfo.symbol,
        balance: parseFloat(balance),
      }
  })
  const borrows = obligation.borrows.map((b) => {
      const s = b.amount.toString()
      const tokenInfo = tokensMap.get(b.mintAddress)
      const balance = s.slice(0, s.length-tokenInfo.decimals) + '.' + s.slice(s.length - tokenInfo.decimals)
      return {
        symbol: tokenInfo.symbol,
        balance: parseFloat(balance),
      }
  })
  return {
      deposits: deposits,
      borrows: borrows
  }
}


const getOrcaData = async (conn, pubkey) => {
  const orca = getOrca(conn);

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

          return {
              maxPoolTokenAmountIn: res.maxPoolTokenAmountIn.toNumber(), minTokenAOut: res.minTokenAOut.toNumber(), minTokenBOut: res.minTokenBOut.toNumber(), constantProduct: res.minTokenAOut.toNumber() * res.minTokenBOut.toNumber(), unclaimedOrca: unclaimedOrca.toNumber(),
          }
    })
    }).catch(console.error)
  })
}

exports.main = async () => {
    const pubkey = new PublicKey(process.env.OWNER_PUBKEY)
    const conn = new Connection(process.env.NODERPC_ENDPOINT, {commit: 'finalized'})
    return conn.getSlot().then((slot) => {
      const promises = []
      promises.push(conn.getBlockTime(slot));
      promises.push(getOrcaData(conn, pubkey));
      promises.push(getSolendData(conn, pubkey));
      return Promise.all(promises).then(([blocktime, orcaData, solendData]) => {
        const ps = []
        ps.push(appendSheet('Sheet1!A2', [[slot, blocktime,data.maxPoolTokenAmountIn, data.minTokenAOut, data.minTokenBOut, data.constantProduct, data.unclaimedOrca]]));
        ps.push(getSolendData(conn, pubkey).then(data => {
          const ustdeposit = data.deposits.find(d => d.symbol == "UST")
          const solborrow = data.borrows.find(b => b.symbol == "SOL")
          appendSheet('Sheet2!A2', [[slot, blocktime, ustdeposit.balance, solborrow.balance]])
        }));
        return Promise.all(ps).then(console.log);
        })
      })
    }
};
