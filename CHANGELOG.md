# CHANGELOG

## Modification Record

| Change Type                     | Description & Cause                                                                                            | Files Affected                                                                                       |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **Solidity Version Upgrade**    | Solidity version upgraded from 0.5.x to 0.8.x                                                                  | contracts/deterministic-deployment-proxy.yul                                      |
| **Testing Workflow**               | 1. Test framework migrates from Waffle to Hardhat, <br>2. ethersv5 upgrade to ethersv6                         | scripts/deploy-proxy,.ts(newAdded), <br> test/deploy-proxy.test.ts |
| **Contract Logic Modification** | Core changes to smart contract logic due to a fundamental incompatibility between the EVM and PolkaVM runtime. |                 |


## Issue Report
### [deterministic-deply-polkadot] CodeNotFound when using Deterministic Deployment Proxy on PolkaVM
When using an Ethereum-native deterministic deployment pattern on a PolkaVM-based chain, a `CodeNotFound` error occurs.

### Analysis
The root cause is the fundamental difference between the contract deployment models of EVM and PolkaVM.
- **EVM Model**: A deployment proxy contract typically receives the full creation bytecode of a target contract. It then uses the CREATE2 opcode to deploy this bytecode directly to a predictable address.
- **PolkaVM Model**: This model separates a contract's code from its instances.
    1. Upload: The contract's code must first be uploaded to the chain, which stores it and assigns it a unique code_hash.
    2. Instantiate: A new instance is created by calling a system function with the code_hash of the already-uploaded code.
The conflict arises when the EVM pattern is used on PolkaVM. The proxy, expecting a `code_hash`, receives the full bytecode. It incorrectly interprets the first 32 bytes of this bytecode as the `code_hash`. Since this arbitrary 32-byte slice does not correspond to any valid code uploaded on-chain, the runtime cannot find the contract code and returns a CodeNotFound error.

### Solution for PolkaVM
To correctly use the deterministic deployment proxy on PolkaVM, the transaction must contain the `code_hash` of the target contract, not its bytecode. The workflow inside the test should be:
1. deploy the Storage contract normally. This uploads its code to the chain.
2. Calculate the code_hash from the deployed contract's on-chain bytecode.
3. Send a transaction to the proxy containing only the salt and this valid `code_hash` to instantiate the contract.