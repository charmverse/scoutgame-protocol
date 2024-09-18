import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { task } from 'hardhat/config';
import { createPublicClient, createWalletClient, http, encodeDeployData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getConnectorFromHardhatRuntimeEnvironment } from '../../lib/connectors';
import { bigint } from 'hardhat/internal/core/params/argumentTypes';

dotenv.config();

const PRIVATE_KEY = (process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`) as `0x${string}`;

task('deployBuilderNFT', 'Deploys the BuilderNFT contract')
  .setAction(async (taskArgs, hre) => {
    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

    await hre.run('compile');

    const artifactPath = path.resolve(__dirname, '../../artifacts/contracts/BuilderNFT.sol/BuilderNFT.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const contractBytecode = artifact.bytecode;
    const contractABI = artifact.abi;

    const client = createPublicClient({
      chain: connector.chain,
      transport: http(connector.rpcUrl),
    });

    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      chain: connector.chain,
      transport: http(connector.rpcUrl),
    });

    console.log("Deploying BuilderNFT with the account:", account.address, "on chain:", connector.chain.name);

    const encodedData = encodeDeployData({
      abi: contractABI,
      bytecode: contractBytecode,
      args: ['http://localhost:3000/api/nft/{id}.json', "0xB5beacf4eE08198dad9C1f2BcB78e7B22DC15074", BigInt(1e15)],
    });

    const deployTx = await walletClient.sendTransaction({
      data: encodedData,
      // gasLimit: 6000000n,
      gasPrice: 100000000n,
    });

    const receipt = await client.waitForTransactionReceipt({ hash: deployTx });

    console.log("BuilderNFT deployed to:", receipt.contractAddress);

    fs.writeFileSync(path.resolve(__dirname, '..', '..', 'abis', 'BuilderNFT.json'), JSON.stringify(contractABI, null, 2));
  });


module.exports = {};