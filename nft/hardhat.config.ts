import "@nomicfoundation/hardhat-toolbox";
import "@zetachain/standard-contracts/tasks/nft";
import "@zetachain/localnet/tasks";
import "@zetachain/toolkit/tasks";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";

import { getHardhatConfig } from "@zetachain/toolkit/utils";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const config: HardhatUserConfig = {
  ...getHardhatConfig({ accounts: [process.env.PRIVATE_KEY || ""] }),
  solidity: {
    compilers: [
      {
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
        version: "0.8.26",
      },
    ],
  },
};

export default config;
