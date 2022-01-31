import { useState } from "react";
import { Connection, clusterApiUrl, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import './App.css';


const App = () => {

  const [walletConnected, setWalletConnected] = useState(false);
  const [provider, setProvider] = useState();
  const [loading, setLoading] = useState();

  const [setIsTokenCreated] = useState(false);
  const [createdTokenPublicKey, setCreatedTokenPublicKey] = useState(null)
  const [mintingWalletSecretKey, setMintingWalletSecretKey] = useState(null)

  const [supplyCapped, setSupplyCapped] = useState(false)


  // Connecting with Phantom Wallet 
  const getProvider = async () => {
    if ("solana" in window) {
      const provider = window.solana;
      if (provider.isPhantom) {
        return provider;
      }
    } else {
      window.open("https://www.phantom.app/", "_blank");
    }
  };

  const walletConnectionHelper = async () => {
    if (walletConnected) {
      //Disconnect Wallet
      setProvider();
      setWalletConnected(false);
    } else {
      const userWallet = await getProvider();
      if (userWallet) {
        await userWallet.connect();
        userWallet.on("connect", async () => {
          setProvider(userWallet);
          setWalletConnected(true);
        });
      }
    }
  }

  //Sending yourself some SOL

  const airDropHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );
      const fromAirDropSignature = await connection.requestAirdrop(new PublicKey(provider.publicKey), LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });

      console.log(`1 SOL airdropped to your wallet ${provider.publicKey.toString()} successfully`);
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  // Minting your Tokens

  const initialMintHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );

      const mintRequester = await provider.publicKey;
      const mintingFromWallet = await Keypair.generate();
      setMintingWalletSecretKey(JSON.stringify(mintingFromWallet.secretKey));

      const fromAirDropSignature = await connection.requestAirdrop(mintingFromWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });

      const creatorToken = await Token.createMint(connection, mintingFromWallet, mintingFromWallet.publicKey, null, 6, TOKEN_PROGRAM_ID);
      const fromTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(mintingFromWallet.publicKey);
      await creatorToken.mintTo(fromTokenAccount.address, mintingFromWallet.publicKey, [], 1000000);

      const toTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(mintRequester);
      const transaction = new Transaction().add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          toTokenAccount.address,
          mintingFromWallet.publicKey,
          [],
          1000000
        )
      );
      const signature = await sendAndConfirmTransaction(connection, transaction, [mintingFromWallet], { commitment: "confirmed" });

      console.log("SIGNATURE:", signature);

      setCreatedTokenPublicKey(creatorToken.publicKey.toString());
      setIsTokenCreated(true);
      setLoading(false);
    } catch (err) {
      console.log(err)
      setLoading(false);
    }
  }

  // Minting more tokens

  const mintAgainHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );
      const createMintingWallet = await Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const mintRequester = await provider.publicKey;

      const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });

      const creatorToken = new Token(connection, createdTokenPublicKey, TOKEN_PROGRAM_ID, createMintingWallet);
      const fromTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(createMintingWallet.publicKey);
      const toTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(mintRequester);
      await creatorToken.mintTo(fromTokenAccount.address, createMintingWallet.publicKey, [], 100000000);

      const transaction = new Transaction().add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          toTokenAccount.address,
          createMintingWallet.publicKey,
          [],
          100000000
        )
      );
      await sendAndConfirmTransaction(connection, transaction, [createMintingWallet], { commitment: "confirmed" });

      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  // Transferring tokens

  const transferTokenHelper = async () => {
    try {
      setLoading(true);

      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );

      const createMintingWallet = Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const receiverWallet = new PublicKey("5eaFQvgJgvW4rDjcAaKwdBb6ZAJ6avWimftFyjnQB3Aj");

      const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });
      console.log('1 SOL airdropped to the wallet for fee');

      const creatorToken = new Token(connection, createdTokenPublicKey, TOKEN_PROGRAM_ID, createMintingWallet);
      const fromTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(provider.publicKey);
      const toTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(receiverWallet);

      const transaction = new Transaction().add(
        Token.createTransferInstruction(TOKEN_PROGRAM_ID, fromTokenAccount.address, toTokenAccount.address, provider.publicKey, [], 10000000)
      );
      transaction.feePayer = provider.publicKey;
      let blockhashObj = await connection.getRecentBlockhash();
      console.log("blockhashObj", blockhashObj);
      transaction.recentBlockhash = await blockhashObj.blockhash;

      if (transaction) {
        console.log("Txn created successfully");
      }

      let signed = await provider.signTransaction(transaction);
      let signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      console.log("SIGNATURE: ", signature);
      setLoading(false);
    } catch (err) {
      console.log(err)
      setLoading(false);
    }
  }

  // Capping Token Supply

  const capSupplyHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );

      const createMintingWallet = await Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature);

      const creatorToken = new Token(connection, createdTokenPublicKey, TOKEN_PROGRAM_ID, createMintingWallet);
      await creatorToken.setAuthority(createdTokenPublicKey, null, "MintTokens", createMintingWallet.publicKey, [createMintingWallet]);

      setSupplyCapped(true)
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  return (
    <div className="App">
      <div className="head">
        <h1>Create your own token using JavaScript</h1>
      </div>
      {
        walletConnected ? (
          <p className="Pub"><strong>Public Key: </strong> {provider.publicKey.toString()}</p>
        ) : <p></p>
      }
      {
        walletConnected ? (
          <p className="Pub"><strong>Airdrop 1 SOL into your wallet</strong>
            <button className="btn-1" disabled={loading} onClick={airDropHelper}>AirDrop SOL </button>
            <p><strong>Create your own token</strong>
              <button className="btn-1" disabled={loading} onClick={initialMintHelper}>Initial Mint </button>
            </p>
            <p><strong>Mint More 100 tokens</strong>
              <button className="btn-1" disabled={loading || supplyCapped} onClick={mintAgainHelper}>Mint Again</button>
            </p>
            <p><strong>Transfer tokens</strong>
              <button className="btn-1" disabled={loading} onClick={transferTokenHelper}>Transfer 10 tokens</button>
            </p>
            <p><strong>Cap Token Supply</strong>
              <button className="btn-1" disabled={loading} onClick={capSupplyHelper}>Cap token Supply</button>
            </p>
          </p>) : <p></p>
      }
      <button className="fill" onClick={walletConnectionHelper} disabled={loading}>
        {!walletConnected ? "Connect Wallet" : "Disconnect Wallet"}
      </button>
    </div>
  )
};


export default App;