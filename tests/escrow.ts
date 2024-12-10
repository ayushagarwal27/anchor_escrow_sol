import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { randomBytes } from "crypto";
import {
  createMint,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

describe("escrow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Escrow as Program<Escrow>;

  const wallet = provider.wallet as NodeWallet;

  const maker = anchor.web3.Keypair.generate();
  const taker = anchor.web3.Keypair.generate();

  let mintA = anchor.web3.PublicKey;
  let mintB = anchor.web3.PublicKey;

  let makerAtaA = anchor.web3.PublicKey;
  let makerAtaB = anchor.web3.PublicKey;

  let takerAtaA = anchor.web3.PublicKey;
  let takerAtaB = anchor.web3.PublicKey;

  const seed = new anchor.BN(randomBytes(8));

  const escrow = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      maker.publicKey.toBuffer(),
      seed.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )[0];

  it("Airdrops SOL to maker and taker", async () => {
    const latestBlockHash = await provider.connection.getLatestBlockhash();
    const tx = await provider.connection.requestAirdrop(
      maker.publicKey,
      1000000000
    );

    await provider.connection.confirmTransaction({
      signature: tx,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      blockhash: latestBlockHash.blockhash,
    });

    console.log(
      "Maker Balance: ",
      await provider.connection.getBalance(maker.publicKey)
    );
    const tx1 = await provider.connection.requestAirdrop(
      taker.publicKey,
      1000000000
    );
    await provider.connection.confirmTransaction({
      signature: tx1,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      blockhash: latestBlockHash.blockhash,
    });

    console.log(
      "Taker Balance: ",
      await provider.connection.getBalance(taker.publicKey)
    );
  });

  it("Create Tokens and Mints Tokens", async () => {
    // @ts-ignore
    mintA = await createMint(
      provider.connection,
      wallet.payer,
      provider.publicKey,
      provider.publicKey,
      6
    );

    // @ts-ignore
    console.log("Mint A: ", mintA.toBase58());

    // @ts-ignore
    mintB = await createMint(
      provider.connection,
      wallet.payer,
      provider.publicKey,
      provider.publicKey,
      6
    );

    // @ts-ignore
    console.log("Mint B: ", mintB.toBase58());

    // @ts-ignore
    makerAtaA = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        // @ts-ignore
        mintA,
        maker.publicKey
      )
    ).address;
    // @ts-ignore
    makerAtaB = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        // @ts-ignore
        mintB,
        maker.publicKey
      )
    ).address;

    // @ts-ignore
    takerAtaA = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        // @ts-ignore
        mintA,
        taker.publicKey
      )
    ).address;
    // @ts-ignore
    takerAtaB = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        // @ts-ignore
        mintB,
        taker.publicKey
      )
    ).address;

    await mintTo(
      provider.connection,
      wallet.payer,
      // @ts-ignore
      mintA,
      makerAtaA,
      provider.publicKey,
      1_000_000_0
    );
    await mintTo(
      provider.connection,
      wallet.payer,
      // @ts-ignore
      mintB,
      makerAtaB,
      provider.publicKey,
      1_000_000_0
    );

    await mintTo(
      provider.connection,
      wallet.payer,
      // @ts-ignore
      mintA,
      takerAtaA,
      provider.publicKey,
      1_000_000_0
    );
    await mintTo(
      provider.connection,
      wallet.payer,
      // @ts-ignore
      mintB,
      takerAtaB,
      provider.publicKey,
      1_000_000_0
    );
  });

  it("Make Escrow Account", async () => {
    // @ts-ignore
    const vault = getAssociatedTokenAddress(mintA, escrow, true);
    // Add your test here.
    const tx = await program.methods
      .make(seed, new anchor.BN(1_000_000), new anchor.BN(1_000_000))
      .accountsPartial({
        maker: maker.publicKey,
        // @ts-ignore
        mintA,
        // @ts-ignore
        mintB,
        // @ts-ignore
        makerAtaA,
        escrow,
        // @ts-ignore
        vault,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([maker])
      .rpc();
    console.log("Your transaction signature: ", tx);
  });
});
