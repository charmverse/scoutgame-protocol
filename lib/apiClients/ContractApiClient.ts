
  import type { Abi, Account, Address, Chain, Client, PublicActions, PublicClient, RpcSchema, Transport, WalletActions, WalletClient } from 'viem';
  import { encodeFunctionData, decodeFunctionResult, getAddress } from 'viem';

  // ReadWriteWalletClient reflects a wallet client that has been extended with PublicActions
  //  https://github.com/wevm/viem/discussions/1463#discussioncomment-7504732
  type ReadWriteWalletClient<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
    account extends Account | undefined = Account | undefined,
  > = Client<
    transport,
    chain,
    account,
    RpcSchema,
    PublicActions<transport, chain, account> & WalletActions<chain, account>
  >;

  export class ContractApiClient {

    private contractAddress: Address;
    private publicClient: PublicClient;
    private walletClient?: ReadWriteWalletClient;
    private chain: Chain;

    private abi: Abi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "scout",
        "type": "string"
      }
    ],
    "name": "buyToken",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "getBuilderIdForToken",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "builderId",
        "type": "string"
      }
    ],
    "name": "getTokenIdForBuilder",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "getTokenPurchasePrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "builderId",
        "type": "string"
      }
    ],
    "name": "registerBuilderToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalBuilderTokens",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

    constructor({
      contractAddress,
      publicClient,
      walletClient,
      chain
    }: {
      contractAddress: Address,
      chain: Chain,
      publicClient?: PublicClient,
      walletClient?: ReadWriteWalletClient,
    }) {
      if (!publicClient && !walletClient) {
        throw new Error('At least one client is required.');
      } else if (publicClient && walletClient) {
        throw new Error('Provide only a public client or wallet clients'); 
      };

      this.chain = chain;
      this.contractAddress = contractAddress;

      const client = publicClient || walletClient;

      if (client!.chain!.id !== chain.id) {
        throw new Error('Client must be on the same chain as the contract. Make sure to add a chain to your client');
      }

      if (publicClient) {
        this.publicClient = publicClient;
      } else {
        this.walletClient = walletClient;
        this.publicClient = walletClient as PublicClient; 
      }
    }

    
    async balanceOf(params: { args: { account: string, id: BigInt },  }): Promise<BigInt> {
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "balanceOf",
        args: [params.args.account, params.args.id],
      });

      const { data } = await this.publicClient.call({
        to: this.contractAddress,
        data: txData,
      });

      // Decode the result based on the expected return type
      const result = decodeFunctionResult({
        abi: this.abi,
        functionName: "balanceOf",
        data: data as `0x${string}`,
      });

      // Parse the result based on the return type
      return result as BigInt;
    }
    

    async buyToken(params: { args: { tokenId: BigInt, amount: BigInt, scout: string }, value?: bigint, gasPrice?: bigint }): Promise<any> {
      if (!this.walletClient) {
        throw new Error('Wallet client is required for write operations.');
      }
      
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "buyToken",
        args: [params.args.tokenId, params.args.amount, params.args.scout],
      });

      const txInput: Omit<Parameters<WalletClient['sendTransaction']>[0], 'account' | 'chain'> = {
        to: getAddress(this.contractAddress),
        data: txData,
        value: params.value ?? BigInt(0), // Optional value for payable methods
        gasPrice: params.gasPrice, // Optional gasPrice
      };

      // This is necessary because the wallet client requires account and chain, which actually cause writes to throw
      const tx = await this.walletClient.sendTransaction(txInput as any);

      // Return the transaction receipt
      return this.walletClient.waitForTransactionReceipt({ hash: tx });
    }
    

    async getBuilderIdForToken(params: { args: { tokenId: BigInt },  }): Promise<string> {
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "getBuilderIdForToken",
        args: [params.args.tokenId],
      });

      const { data } = await this.publicClient.call({
        to: this.contractAddress,
        data: txData,
      });

      // Decode the result based on the expected return type
      const result = decodeFunctionResult({
        abi: this.abi,
        functionName: "getBuilderIdForToken",
        data: data as `0x${string}`,
      });

      // Parse the result based on the return type
      return result as string;
    }
    

    async getTokenIdForBuilder(params: { args: { builderId: string },  }): Promise<BigInt> {
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "getTokenIdForBuilder",
        args: [params.args.builderId],
      });

      const { data } = await this.publicClient.call({
        to: this.contractAddress,
        data: txData,
      });

      // Decode the result based on the expected return type
      const result = decodeFunctionResult({
        abi: this.abi,
        functionName: "getTokenIdForBuilder",
        data: data as `0x${string}`,
      });

      // Parse the result based on the return type
      return result as BigInt;
    }
    

    async getTokenPurchasePrice(params: { args: { tokenId: BigInt, amount: BigInt },  }): Promise<BigInt> {
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "getTokenPurchasePrice",
        args: [params.args.tokenId, params.args.amount],
      });

      const { data } = await this.publicClient.call({
        to: this.contractAddress,
        data: txData,
      });

      // Decode the result based on the expected return type
      const result = decodeFunctionResult({
        abi: this.abi,
        functionName: "getTokenPurchasePrice",
        data: data as `0x${string}`,
      });

      // Parse the result based on the return type
      return result as BigInt;
    }
    

    async registerBuilderToken(params: { args: { builderId: string }, value?: bigint, gasPrice?: bigint }): Promise<any> {
      if (!this.walletClient) {
        throw new Error('Wallet client is required for write operations.');
      }
      
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "registerBuilderToken",
        args: [params.args.builderId],
      });

      const txInput: Omit<Parameters<WalletClient['sendTransaction']>[0], 'account' | 'chain'> = {
        to: getAddress(this.contractAddress),
        data: txData,
        value: params.value ?? BigInt(0), // Optional value for payable methods
        gasPrice: params.gasPrice, // Optional gasPrice
      };

      // This is necessary because the wallet client requires account and chain, which actually cause writes to throw
      const tx = await this.walletClient.sendTransaction(txInput as any);

      // Return the transaction receipt
      return this.walletClient.waitForTransactionReceipt({ hash: tx });
    }
    

    async totalBuilderTokens(params: {  }): Promise<BigInt> {
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "totalBuilderTokens",
        args: [],
      });

      const { data } = await this.publicClient.call({
        to: this.contractAddress,
        data: txData,
      });

      // Decode the result based on the expected return type
      const result = decodeFunctionResult({
        abi: this.abi,
        functionName: "totalBuilderTokens",
        data: data as `0x${string}`,
      });

      // Parse the result based on the return type
      return result as BigInt;
    }
    

    async totalSupply(params: { args: { tokenId: BigInt },  }): Promise<BigInt> {
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "totalSupply",
        args: [params.args.tokenId],
      });

      const { data } = await this.publicClient.call({
        to: this.contractAddress,
        data: txData,
      });

      // Decode the result based on the expected return type
      const result = decodeFunctionResult({
        abi: this.abi,
        functionName: "totalSupply",
        data: data as `0x${string}`,
      });

      // Parse the result based on the return type
      return result as BigInt;
    }
    
  }

  