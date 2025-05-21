// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract DeterministicDeploymentProxy {
    // 运行时代码
    fallback() external payable {
        assembly {
            // 从 calldata 复制字节码（跳过前32字节的salt）
            calldatacopy(0, 32, sub(calldatasize(), 32))

            // 使用 create2 部署合约
            // 参数: value, offset, size, salt
            let result := create2(
                callvalue(), // value
                0, // offset
                sub(calldatasize(), 32), // size
                calldataload(0) // salt (前32字节)
            )

            // 如果部署失败则回滚
            if iszero(result) {
                revert(0, 0)
            }

            // 返回部署的地址（20字节）
            mstore(0, result)
            return(12, 20)
        }
    }
}
