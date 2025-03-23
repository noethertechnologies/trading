"use client";

import React, { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface StockData {
  symbol: string;
  lastPrice: number;
  change?: number;
  pChange?: number;
  investmentValue?: number;
  quantity?: number;
  profitLoss?: number;
  profitLossPercentage?: number;
}

const Page: React.FC = () => {
  const [inputSymbol, setInputSymbol] = useState("");
  const [stockDataList, setStockDataList] = useState<StockData[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch stock data for the input symbol
  const fetchStockData = useCallback(() => {
    const symbol = inputSymbol.trim().toUpperCase();
    if (!symbol) {
      alert("Enter a valid stock symbol.");
      return;
    }

    socket?.emit("subscribeToSymbols", [symbol]);
  }, [inputSymbol, socket]);

  // Handle buy/sell actions
  const handleBuySell = useCallback(
    (symbol: string, action: "buy" | "sell") => {
      const stockData = stockDataList.find((stock) => stock.symbol === symbol);
      if (!stockData) {
        alert("No stock data available to process the request.");
        return;
      }

      const quantityStr = prompt(`Enter quantity to ${action}:`);
      const quantity = parseInt(quantityStr || "0", 10);

      if (isNaN(quantity) || quantity <= 0) {
        alert("Invalid quantity entered.");
        return;
      }

      const payload = { symbol, action, quantity, price: stockData.lastPrice };
      socket?.emit("buySellStock", payload);
    },
    [stockDataList, socket]
  );

  // Establish WebSocket connection and listeners
  useEffect(() => {
    const socketConnection = io({ path: "/api/socket" });

    socketConnection.on("connect", () => console.log("Connected to server"));

    // Update stock data in real-time
    socketConnection.on("stockData", (data: StockData[]) => {
      setStockDataList((prevList) => {
        const updatedList = [...prevList];
        data.forEach((newData) => {
          const index = updatedList.findIndex((stock) => stock.symbol === newData.symbol);
          if (index !== -1) {
            updatedList[index] = {
              ...updatedList[index],
              ...newData,
            };
          } else {
            updatedList.push(newData);
          }
        });
        return updatedList;
      });
    });

    // Handle investment updates
    socketConnection.on("investmentUpdate", (data: StockData) => {
      setStockDataList((prevList) =>
        prevList.map((stock) =>
          stock.symbol === data.symbol
            ? {
                ...stock,
                ...data,
              }
            : stock
        )
      );
    });

    socketConnection.on("error", (message: string) => alert(message));

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  // Calculate total investment and profit/loss
  const totalInvestment = stockDataList.reduce(
    (sum, stock) => sum + (stock.investmentValue || 0),
    0
  );
  const totalProfitLoss = stockDataList.reduce(
    (sum, stock) => sum + (stock.profitLoss || 0),
    0
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-6 text-center">Stock Dashboard</h1>
      <div className="flex items-center justify-center mb-4">
        <input
          type="text"
          value={inputSymbol}
          onChange={(e) => setInputSymbol(e.target.value)}
          placeholder="Enter stock symbol"
          className="border border-gray-300 p-2 rounded-lg w-1/3"
        />
        <button
          onClick={fetchStockData}
          className="bg-blue-500 text-white p-2 ml-2 rounded-lg hover:bg-blue-600 transition"
        >
          Search
        </button>
      </div>
      <table className="table-auto w-full bg-white shadow-md rounded-lg overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            <th className="px-4 py-2">Symbol</th>
            <th className="px-4 py-2">Last Price (₹)</th>
            <th className="px-4 py-2">Change (₹)</th>
            <th className="px-4 py-2">PChange (%)</th>
            <th className="px-4 py-2">Investment (₹)</th>
            <th className="px-4 py-2">Quantity</th>
            <th className="px-4 py-2">Profit/Loss (₹)</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {stockDataList.map((stock) => (
            <tr key={stock.symbol} className="text-center">
              <td className="border px-4 py-2">{stock.symbol}</td>
              <td className="border px-4 py-2">{stock.lastPrice.toFixed(2)}</td>
              <td className="border px-4 py-2">{(stock.change || 0).toFixed(2)}</td>
              <td className="border px-4 py-2">{(stock.pChange || 0).toFixed(2)}</td>
              <td className="border px-4 py-2">{(stock.investmentValue || 0).toFixed(2)}</td>
              <td className="border px-4 py-2">{stock.quantity || 0}</td>
              <td className="border px-4 py-2">{(stock.profitLoss || 0).toFixed(2)}</td>
              <td className="border px-4 py-2">
                <button
                  onClick={() => handleBuySell(stock.symbol, "buy")}
                  className="bg-green-500 text-white px-2 py-1 rounded-lg mr-2 hover:bg-green-600 transition"
                >
                  Buy
                </button>
                <button
                  onClick={() => handleBuySell(stock.symbol, "sell")}
                  className="bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 transition"
                >
                  Sell
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-100">
          <tr className="text-center font-bold">
            <td className="border px-4 py-2" colSpan={4}>Total</td>
            <td className="border px-4 py-2">{totalInvestment.toFixed(2)}</td>
            <td className="border px-4 py-2"></td>
            <td className="border px-4 py-2">{totalProfitLoss.toFixed(2)}</td>
            <td className="border px-4 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default Page;