import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Read proxy bytecode
  const bytecodePath = path.join(__dirname, "..", "output", "bytecode.txt");
  const proxyBytecode = fs.readFileSync(bytecodePath, "utf8").trim();

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy proxy first
  console.log("Deploying proxy...");
  const Proxy = new ethers.ContractFactory(
    [], // No ABI needed
    proxyBytecode,
    deployer
  );

  const proxy = await Proxy.deploy();
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("Proxy deployed to:", proxyAddress);

  // Get Storage contract bytecode
  const Storage = await ethers.getContractFactory("Storage");
  // upload the storage contract onchain
  const storage = await Storage.deploy();
  await storage.waitForDeployment();
  console.log("Storage deployed to:", await storage.getAddress());
  const storageBytecode = Storage.bytecode;
  console.log("Storage contract bytecode length:", storageBytecode.length);

  const storageByteCodeHash = ethers.keccak256(storageBytecode);

  // Generate salt for create2
  const salt = ethers.randomBytes(32);
  console.log("Using salt:", ethers.hexlify(salt));

  // Construct calldata
  // Format: [salt (32 bytes)][bytecodeHash]
  const calldata = ethers.concat([
    salt, // 32 bytes salt
    storageByteCodeHash // contract bytecode
  ]);

  // Deploy using raw transaction
  console.log("Deploying Storage through proxy...");
  const tx = await deployer.sendTransaction({
    to: proxyAddress,
    data: calldata,
    value: 0
  });
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Transaction failed");
  console.log("Deployment transaction:", receipt.hash);

  // Calculate the deployed address
  const deployedAddress = ethers.getCreate2Address(
    proxyAddress,
    salt,
    storageByteCodeHash
  );
  console.log("Storage contract deployed to:", deployedAddress);

  // Verify the deployment
  const code = await ethers.provider.getCode(deployedAddress);
  console.log("Deployed contract code length:", code.length);
  console.log("Deployment successful:", code !== "0x");

  // Save deployment info
  const deploymentInfo = {
    proxy: {
      address: proxyAddress,
      bytecode: proxyBytecode
    },
    storage: {
      address: deployedAddress,
      bytecode: storageBytecode,
      salt: ethers.hexlify(salt)
    },
    calldata: ethers.hexlify(calldata),
    deployer: deployer.address,
    transaction: receipt.hash
  };

  const network = await ethers.provider.getNetwork();
  const deploymentPath = path.join(__dirname, "..", "output", `deployment-${network.name}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info saved to:", deploymentPath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 