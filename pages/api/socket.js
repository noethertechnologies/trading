import { Server } from "socket.io";
import NseIndia from "../../utils/nse";

const nse = new NseIndia();

const SocketHandler = (req, res) => {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      path: "/api/socket",
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    res.socket.server.io = io;

    const investments = {}; // Store investments in-memory

    io.on("connection", (socket) => {
      console.log("Client connected");

      // Subscribe to symbols and provide updates
      socket.on("subscribeToSymbols", (symbols) => {
        if (!symbols || symbols.length === 0) {
          socket.emit("error", "No symbols provided for subscription.");
          return;
        }

        const fetchStockData = async () => {
          const stockDataPromises = symbols.map(async (symbol) => {
            try {
              const equityDetails = await nse.getEquityDetails(symbol.toUpperCase());
              if (!equityDetails) {
                throw new Error("Stock details not found.");
              }

              const lastPrice = equityDetails.priceInfo.lastPrice || 0;
              const change = equityDetails.priceInfo.change || 0;
              const pChange = equityDetails.priceInfo.pChange || 0;

              if (!investments[symbol]) {
                investments[symbol] = { investmentValue: 0, quantity: 0 };
              }

              const { investmentValue, quantity } = investments[symbol];
              const currentValue = quantity * lastPrice;
              const profitLoss = currentValue - investmentValue;
              const profitLossPercentage = investmentValue
                ? (profitLoss / investmentValue) * 100
                : 0;

              return {
                symbol,
                lastPrice,
                change,
                pChange,
                investmentValue,
                quantity,
                profitLoss,
                profitLossPercentage,
              };
            } catch (error) {
              console.error(`Error fetching data for symbol: ${symbol}`, error);
              return null;
            }
          });

          const stockData = await Promise.all(stockDataPromises);

          // Emit updated stock data to the client
          socket.emit("stockData", stockData.filter((data) => data !== null));
        };

        // Fetch data initially and then at regular intervals
        fetchStockData();
        const intervalId = setInterval(fetchStockData, 5000);

        // Clear interval on disconnect
        socket.on("disconnect", () => {
          clearInterval(intervalId);
          console.log("Client disconnected");
        });
      });

      // Handle buy/sell stock actions
      socket.on("buySellStock", ({ symbol, action, quantity, price }) => {
        if (!symbol || !action || !quantity || !price) {
          socket.emit("error", "Invalid buy/sell request.");
          return;
        }

        if (!investments[symbol]) {
          investments[symbol] = { investmentValue: 0, quantity: 0 };
        }

        const investment = investments[symbol];

        if (action === "buy") {
          investment.investmentValue += quantity * price;
          investment.quantity += quantity;
        } else if (action === "sell") {
          if (investment.quantity < quantity) {
            socket.emit("error", "Not enough quantity to sell.");
            return;
          }
          investment.quantity -= quantity;
          investment.investmentValue = investment.quantity * price;
        }

        const currentValue = investment.quantity * price;
        const profitLoss = currentValue - investment.investmentValue;
        const profitLossPercentage = investment.investmentValue
          ? (profitLoss / investment.investmentValue) * 100
          : 0;

        const updatedData = {
          symbol,
          lastPrice: price,
          investmentValue: investment.investmentValue,
          quantity: investment.quantity,
          profitLoss,
          profitLossPercentage,
        };

        // Emit investment update to the client
        socket.emit("investmentUpdate", updatedData);
      });
    });
  }

  res.end();
};

export default SocketHandler;