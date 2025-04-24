"use client"
import React from "react"

import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  TYPE_SIZE,
  LENGTH_SIZE,
  getMintLen,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token"
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js"
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Toaster, toast } from "react-hot-toast"
import { WalletMultiButton, WalletDisconnectButton } from "@solana/wallet-adapter-react-ui"
import { Rocket, Coins, Sparkles, ChevronRight, Check, AlertCircle } from "lucide-react"

const TokenLaunchPad = () => {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [formData, setFormData] = useState({
    tokenName: "",
    symbol: "",
    decimals: 9,
    initialSupply: 1000000,
  })

  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prevState) => ({
      ...prevState,
      [name]: name === "decimals" || name === "initialSupply" ? Number.parseFloat(value) : value,
    }))
  }

  async function customCreateMint(event) {
    event.preventDefault()
    if (!wallet.publicKey) {
      toast.error("Connect your wallet first!")
      return
    }
    if (!formData.tokenName || !formData.symbol || !formData.initialSupply) {
      toast.error("Please fill in all the required fields before proceeding.")
      return
    }

    setLoading(true)
    setCurrentStep(1)

    try {
      const mintKeypair = Keypair.generate()
      const metadata = {
        mint: mintKeypair.publicKey,
        name: formData.tokenName,
        symbol: formData.symbol,
        uri: "your-metadata-uri-here",
        additionalMetadata: [],
      }

      const mintLen = getMintLen([ExtensionType.MetadataPointer])
      const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length

      const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen)

      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: mintLen,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeMetadataPointerInstruction(
          mintKeypair.publicKey,
          wallet.publicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID,
        ),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          formData.decimals,
          wallet.publicKey,
          null,
          TOKEN_2022_PROGRAM_ID,
        ),
        createInitializeInstruction({
          programId: TOKEN_2022_PROGRAM_ID,
          mint: mintKeypair.publicKey,
          metadata: mintKeypair.publicKey,
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadata.uri,
          mintAuthority: wallet.publicKey,
          updateAuthority: wallet.publicKey,
        }),
      )

      transaction.feePayer = wallet.publicKey
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      transaction.partialSign(mintKeypair)

      await wallet.sendTransaction(transaction, connection)
      toast.success("Token metadata initialized successfully!")
      setCompletedSteps((prev) => [...prev, 1])
      setCurrentStep(2)

      await new Promise((resolve) => setTimeout(resolve, 2000))

      const associatedToken = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      )

      const transaction2 = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          associatedToken,
          wallet.publicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID,
        ),
      )

      await wallet.sendTransaction(transaction2, connection)
      toast.success("Associated token account created!")
      setCompletedSteps((prev) => [...prev, 2])
      setCurrentStep(3)

      await new Promise((resolve) => setTimeout(resolve, 2000))

      const transaction3 = new Transaction().add(
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedToken,
          wallet.publicKey,
          formData.initialSupply * LAMPORTS_PER_SOL,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      )

      await wallet.sendTransaction(transaction3, connection)
      toast.success("Token minted successfully! 🎉")
      setCompletedSteps((prev) => [...prev, 3])

      // Show success message with token details
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <p className="font-bold">Token Created Successfully!</p>
            <p>Name: {formData.tokenName}</p>
            <p>Symbol: {formData.symbol}</p>
            <p>
              Mint: {mintKeypair.publicKey.toString().slice(0, 8)}...{mintKeypair.publicKey.toString().slice(-8)}
            </p>
          </div>
        ),
        { duration: 6000 },
      )
    } catch (error) {
      console.error("Token creation failed:", error)
      toast.error("Failed to create token. Try again!")
    } finally {
      setLoading(false)
      setTimeout(() => {
        setCurrentStep(0)
        setCompletedSteps([])
      }, 5000)
    }

    setFormData({
      tokenName: "",
      symbol: "",
      decimals: 9,
      initialSupply: 1000000,
    })
  }

  const steps = [
    { id: 0, title: "Configure Token", icon: <Coins className="w-6 h-6" /> },
    { id: 1, title: "Initialize Metadata", icon: <Sparkles className="w-6 h-6" /> },
    { id: 2, title: "Create Token Account", icon: <Coins className="w-6 h-6" /> },
    { id: 3, title: "Mint Initial Supply", icon: <Rocket className="w-6 h-6" /> },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 text-white flex flex-col items-center justify-center p-4 md:p-12">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1f2937",
            color: "#fff",
            border: "1px solid #374151",
          },
        }}
      />

      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col sm:flex-row justify-between w-full max-w-4xl mb-8 gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 p-2 rounded-full">
            <Rocket className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text">
            Solana Token LaunchPad
          </h1>
        </div>

        <div className="flex gap-4">
          <WalletMultiButton className="!bg-purple-700 hover:!bg-purple-600 !text-white !px-4 !py-2 !rounded-lg !transition !shadow-lg hover:!shadow-purple-500/30" />
          {wallet.connected && (
            <WalletDisconnectButton className="!bg-gray-800 hover:!bg-gray-700 !text-white !px-4 !py-2 !rounded-lg !transition !shadow-lg" />
          )}
        </div>
      </motion.div>

      {loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-4xl mb-8">
          <div className="bg-gray-800/80 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4">Creating Your Token</h3>
            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center gap-4">
                  <div
                    className={`rounded-full p-2 ${
                      completedSteps.includes(step.id)
                        ? "bg-green-500/20 text-green-400"
                        : currentStep === step.id
                          ? "bg-purple-500/20 text-purple-400 animate-pulse"
                          : "bg-gray-700/50 text-gray-400"
                    }`}
                  >
                    {completedSteps.includes(step.id) ? <Check className="w-5 h-5" /> : step.icon}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        completedSteps.includes(step.id)
                          ? "text-green-400"
                          : currentStep === step.id
                            ? "text-purple-400"
                            : "text-gray-400"
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                  {currentStep === step.id && !completedSteps.includes(step.id) && (
                    <div className="animate-pulse text-purple-400">Processing...</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {!loading && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-gray-900/80 rounded-3xl shadow-2xl p-8 md:p-12 max-w-4xl w-full border border-gray-800 backdrop-blur-md hover:shadow-purple-500/20 transition-all duration-500"
          >
            <div className="flex flex-col md:flex-row gap-8 md:gap-16">
              <div className="md:w-1/3">
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="sticky top-8"
                >
                  <h2 className="text-3xl md:text-4xl font-extrabold mb-6 bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text">
                    🚀 Token LaunchPad
                  </h2>

                  <p className="text-gray-400 mb-8">
                    Create your own Solana token in seconds with our easy-to-use token launcher.
                  </p>

                  <div className="space-y-4 hidden md:block">
                    <div className="flex items-center gap-3 text-purple-400">
                      <div className="bg-purple-500/20 p-2 rounded-full">
                        <Check className="w-4 h-4" />
                      </div>
                      <span>SPL Token-2022 Standard</span>
                    </div>
                    <div className="flex items-center gap-3 text-purple-400">
                      <div className="bg-purple-500/20 p-2 rounded-full">
                        <Check className="w-4 h-4" />
                      </div>
                      <span>Built-in Metadata</span>
                    </div>
                    <div className="flex items-center gap-3 text-purple-400">
                      <div className="bg-purple-500/20 p-2 rounded-full">
                        <Check className="w-4 h-4" />
                      </div>
                      <span>Instant Minting</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="md:w-2/3">
                <form onSubmit={customCreateMint} className="grid gap-6">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="flex flex-col"
                  >
                    <label htmlFor="tokenName" className="text-sm text-gray-400 mb-2 font-medium">
                      Token Name
                    </label>
                    <div className="relative">
                      <input
                        id="tokenName"
                        type="text"
                        name="tokenName"
                        value={formData.tokenName}
                        onChange={handleChange}
                        placeholder="e.g. Solana Gold"
                        className="w-full bg-gray-800/50 border border-gray-700 text-white p-4 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition pl-12"
                      />
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="flex flex-col"
                  >
                    <label htmlFor="symbol" className="text-sm text-gray-400 mb-2 font-medium">
                      Symbol
                    </label>
                    <div className="relative">
                      <input
                        id="symbol"
                        type="text"
                        name="symbol"
                        value={formData.symbol}
                        onChange={handleChange}
                        placeholder="e.g. SGLD"
                        className="w-full bg-gray-800/50 border border-gray-700 text-white p-4 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition pl-12"
                      />
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400">
                        <Coins className="w-5 h-5" />
                      </div>
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                      className="flex flex-col"
                    >
                      <label htmlFor="decimals" className="text-sm text-gray-400 mb-2 font-medium">
                        Decimals
                      </label>
                      <input
                        id="decimals"
                        type="number"
                        name="decimals"
                        value={formData.decimals}
                        onChange={handleChange}
                        placeholder="e.g. 9"
                        className="w-full bg-gray-800/50 border border-gray-700 text-white p-4 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      />
                      <p className="text-xs text-gray-500 mt-2">Standard is 9 decimals for most tokens</p>
                    </motion.div>

                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6, duration: 0.5 }}
                      className="flex flex-col"
                    >
                      <label htmlFor="initialSupply" className="text-sm text-gray-400 mb-2 font-medium">
                        Initial Supply
                      </label>
                      <input
                        id="initialSupply"
                        type="number"
                        name="initialSupply"
                        value={formData.initialSupply}
                        onChange={handleChange}
                        placeholder="e.g. 1000000"
                        className="w-full bg-gray-800/50 border border-gray-700 text-white p-4 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      />
                    </motion.div>
                  </div>

                  {!wallet.connected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3 text-yellow-400"
                    >
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm">Please connect your wallet to create a token</p>
                    </motion.div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7, duration: 0.5 }}
                    type="submit"
                    disabled={loading || !wallet.connected}
                    className={`mt-6 w-full ${
                      loading || !wallet.connected
                        ? "bg-gray-700 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                    } font-bold py-4 rounded-xl transition shadow-lg hover:shadow-purple-500/30 flex items-center justify-center gap-2`}
                  >
                    <Rocket className="w-5 h-5" />
                    {loading ? "Creating Your Token..." : "Launch Token"}
                    {!loading && <ChevronRight className="w-5 h-5" />}
                  </motion.button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="mt-8 text-center text-gray-500 text-sm"
      >
        Powered by Solana Token-2022 Program
      </motion.div>
    </div>
  )
}

export default TokenLaunchPad