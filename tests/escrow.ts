import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
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
import { expect } from "chai";
// Configure the client to use the local cluster.
anchor.setProvider(anchor.AnchorProvider.env());

const provider = <anchor.AnchorProvider>anchor.getProvider();
const program = anchor.workspace.Escrow as Program<Escrow>;
const connection = provider.connection;

const maker = provider.wallet as anchor.Wallet;
const taker = anchor.web3.Keypair.generate();

let seed: anchor.BN;
let mintA: anchor.web3.PublicKey;
let mintB: anchor.web3.PublicKey;
let escrow: anchor.web3.PublicKey;
let vault: anchor.web3.PublicKey;
let makerAtaA: anchor.web3.PublicKey;

const receiveAmount = 50_000_000;
const deposit = 10_000_000;
const initialMakerAtaABalance = 100_000_000;
const initialTakerAtaBBalance = 100_000_000;

async function commonSetup() {
  seed = new anchor.BN(Math.floor(Math.random() * 1000_000_000));

  //   Create Mints
  mintA = await createMint(connection, maker.payer, maker.publicKey, null, 6);
  mintB = await createMint(connection, maker.payer, maker.publicKey, null, 6);

  //   Derive escrow address
  escrow = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      maker.publicKey.toBuffer(),
      seed.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )[0];

  //   Derive vault address
  vault = await getAssociatedTokenAddress(mintA, escrow, true);

  makerAtaA = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      maker.payer,
      mintA,
      maker.publicKey
    )
  ).address;

  await mintTo(
    connection,
    maker.payer,
    mintA,
    makerAtaA,
    maker.payer,
    initialMakerAtaABalance
  );

  await connection.requestAirdrop(
    taker.publicKey,
    1 * anchor.web3.LAMPORTS_PER_SOL
  );
}

describe("Make and Refund", () => {
  before(async () => {
    await commonSetup();
  });

  it("Init escrow and deposit", async () => {
    const tx = await program.methods
      .make(seed, new anchor.BN(deposit), new anchor.BN(receiveAmount))
      .accounts({
        maker: maker.publicKey,
        mintA,
        mintB,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker.payer])
      .rpc();
    console.log("Your transaction signature: ", tx);

    const vaultBalance = Number(
      (await connection.getTokenAccountBalance(vault)).value.amount
    );

    const makerAtaBalance = Number(
      (await connection.getTokenAccountBalance(makerAtaA)).value.amount
    );
    expect(vaultBalance).to.equal(deposit);
    expect(makerAtaBalance).to.equal(initialMakerAtaABalance - deposit);
  });

  it("Refunds", async () => {
    const tx = await program.methods
      .refund()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .accountsPartial({
        maker: maker.publicKey,
        mintA,
        escrow,
      })
      .signers([maker.payer])
      .rpc();

    try {
      await connection.getTokenAccountBalance(vault);
    } catch (err) {
      expect(err.toString()).to.include("could not find account");
    }

    const makerAtaBalanceA = Number(
      (await connection.getTokenAccountBalance(makerAtaA)).value.amount
    );
    expect(makerAtaBalanceA).to.equal(initialMakerAtaABalance);
  });
  //   const
  //   // @ts-ignore
  //   const vault = getAssociatedTokenAddress(mintA, escrow, true);
  //
  //   it("Airdrops SOL to maker and taker", async () => {
  //     const latestBlockHash = await provider.connection.getLatestBlockhash();
  //     const tx = await provider.connection.requestAirdrop(
  //       maker.publicKey,
  //       1000000000
  //     );
  //
  //     await provider.connection.confirmTransaction({
  //       signature: tx,
  //       lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
  //       blockhash: latestBlockHash.blockhash,
  //     });
  //
  //     console.log(
  //       "Maker Balance: ",
  //       await provider.connection.getBalance(maker.publicKey)
  //     );
  //     const tx1 = await provider.connection.requestAirdrop(
  //       taker.publicKey,
  //       1000000000
  //     );
  //     await provider.connection.confirmTransaction({
  //       signature: tx1,
  //       lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
  //       blockhash: latestBlockHash.blockhash,
  //     });
  //
  //     console.log(
  //       "Taker Balance: ",
  //       await provider.connection.getBalance(taker.publicKey)
  //     );
  //   });
  //
  //   it("Create Tokens and Mints Tokens", async () => {
  //     // @ts-ignore
  //     mintA = await createMint(
  //       provider.connection,
  //       wallet.payer,
  //       provider.publicKey,
  //       provider.publicKey,
  //       6
  //     );
  //
  //     // @ts-ignore
  //     console.log("Mint A: ", mintA.toBase58());
  //
  //     // @ts-ignore
  //     mintB = await createMint(
  //       provider.connection,
  //       wallet.payer,
  //       provider.publicKey,
  //       provider.publicKey,
  //       6
  //     );
  //
  //     // @ts-ignore
  //     console.log("Mint B: ", mintB.toBase58());
  //
  //     // @ts-ignore
  //     // @ts-ignore
  //     makerAtaB = (
  //       await getOrCreateAssociatedTokenAccount(
  //         provider.connection,
  //         wallet.payer,
  //         // @ts-ignore
  //         mintB,
  //         maker.publicKey
  //       )
  //     ).address;
  //
  //     // @ts-ignore
  //     takerAtaA = (
  //       await getOrCreateAssociatedTokenAccount(
  //         provider.connection,
  //         wallet.payer,
  //         // @ts-ignore
  //         mintA,
  //         taker.publicKey
  //       )
  //     ).address;
  //     // @ts-ignore
  //     takerAtaB = (
  //       await getOrCreateAssociatedTokenAccount(
  //         provider.connection,
  //         wallet.payer,
  //         // @ts-ignore
  //         mintB,
  //         taker.publicKey
  //       )
  //     ).address;
  //
  //     await mintTo(
  //       provider.connection,
  //       wallet.payer,
  //       // @ts-ignore
  //       mintA,
  //       makerAtaA,
  //       provider.publicKey,
  //       1_000_000_0
  //     );
  //     await mintTo(
  //       provider.connection,
  //       wallet.payer,
  //       // @ts-ignore
  //       mintB,
  //       makerAtaB,
  //       provider.publicKey,
  //       1_000_000_0
  //     );
  //
  //     await mintTo(
  //       provider.connection,
  //       wallet.payer,
  //       // @ts-ignore
  //       mintA,
  //       takerAtaA,
  //       provider.publicKey,
  //       1_000_000_0
  //     );
  //     await mintTo(
  //       provider.connection,
  //       wallet.payer,
  //       // @ts-ignore
  //       mintB,
  //       takerAtaB,
  //       provider.publicKey,
  //       1_000_000_0
  //     );
  //   });
  //
  //   // it("Refund and Close Escrow", async () => {
  //   //   // Add your test here.
  //   //   const tx = await program.methods
  //   //     .refund()
  //   //     .accountsPartial({
  //   //       maker: maker.publicKey,
  //   //       // @ts-ignore
  //   //       mintA,
  //   //       // @ts-ignore
  //   //       makerAtaA,
  //   //       escrow,
  //   //       // @ts-ignore
  //   //       vault,
  //   //       tokenProgram: TOKEN_PROGRAM_ID,
  //   //       systemProgram: anchor.web3.SystemProgram.programId,
  //   //     })
  //   //     .signers([maker])
  //   //     .rpc();
  //   //   console.log("Your transaction signature: ", tx);
  //   // });
  //
  //   it("Make Escrow Account", async () => {
  //     // Add your test here.
  //     const tx = await program.methods
  //       .make(seed, new anchor.BN(1_000_000), new anchor.BN(1_000_000))
  //       .accountsPartial({
  //         maker: maker.publicKey,
  //         // @ts-ignore
  //         mintA,
  //         // @ts-ignore
  //         mintB,
  //         // @ts-ignore
  //         makerAtaA,
  //         escrow,
  //         // @ts-ignore
  //         vault,
  //         associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //       })
  //       .signers([maker])
  //       .rpc();
  //     console.log("Your transaction signature: ", tx);
  //   });
  //
  //   it("Take and Close Escrow", async () => {
  //     // @ts-ignore
  //
  //     // Add your test here.
  //     const tx = await program.methods
  //       .take()
  //       .accountsPartial({
  //         maker: maker.publicKey,
  //         taker: taker.publicKey,
  //         // @ts-ignore
  //         mintA,
  //         // @ts-ignore
  //         mintB,
  //         // @ts-ignore
  //         makerAtaA,
  //         // @ts-ignore
  //         takerAtaA,
  //         // @ts-ignore
  //         takerAtaB,
  //         escrow,
  //         // @ts-ignore
  //         vault,
  //         associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //       })
  //       .signers([taker])
  //       .rpc({ skipPreflight: true });
  //     console.log("Your transaction signature: ", tx);
  //   });
});
