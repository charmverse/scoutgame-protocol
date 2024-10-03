// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libs/MemoryUtils.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library ImplementationStorage {
    struct Layout {
        mapping(uint256 => mapping(address => uint256)) balances;
        mapping(uint256 => uint256) totalSupply;
        mapping(uint256 => string) tokenToBuilderRegistry;
        mapping(string => uint256) builderToTokenRegistry;
        string baseUri;
    }

    bytes32 internal constant STORAGE_SLOT = keccak256("builderNFT.implementation.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

contract BuilderNFTSeasonOneImplementation01 is Context, ERC165, IERC1155, IERC1155MetadataURI {
    using MemoryUtils for bytes32;
    using Address for address;

    // Events
    event BuilderScouted(uint256 tokenId, uint256 amount, string scout);
    event BuilderTokenRegistered(uint256 tokenId, string builderId);

    modifier onlyAdmin() {
        require(MemoryUtils.isAdmin(msg.sender), "Proxy: caller is not the admin");
        _;
    }

    constructor () {}

 
    function setBaseUri(string memory newBaseUri) external {
        _setBaseUri(newBaseUri);
    }

    function _setBaseUri(string memory newBaseUri) internal {
        require(bytes(newBaseUri).length > 0, "Empty base URI not allowed");
        ImplementationStorage.layout().baseUri = newBaseUri;
    }

    function registerBuilderToken(string calldata builderId) external onlyAdmin() {
        _registerBuilderToken(builderId);
    }

    function _registerBuilderToken(string calldata builderId) internal {
        require(_isValidUUID(builderId), "Builder ID must be a valid UUID");
        require(ImplementationStorage.layout().builderToTokenRegistry[builderId] == 0, "Builder already registered");

        uint256 nextTokenId = MemoryUtils.getUint256(MemoryUtils.NEXT_TOKEN_ID_SLOT);

        // Update mappings in storage
        ImplementationStorage.layout().tokenToBuilderRegistry[nextTokenId] = builderId;
        ImplementationStorage.layout().builderToTokenRegistry[builderId] = nextTokenId;

        // Emit BuilderTokenRegistered event
        emit BuilderTokenRegistered(nextTokenId, builderId);

        // Increment the next token ID
        MemoryUtils.setUint256(MemoryUtils.NEXT_TOKEN_ID_SLOT, nextTokenId + 1);
    }

    function balanceOf(address account, uint256 id) external view override returns (uint256) {
        return _balanceOf(account, id);
    }

    function _balanceOf(address account, uint256 id) internal view returns (uint256) {
        require(account != address(0), "ERC1155: balance query for the zero address");
        return ImplementationStorage.layout().balances[id][account];
    }

    function balanceOfBatch(address[] memory accounts, uint256[] memory ids) external view override returns (uint256[] memory) {
        return _balanceOfBatch(accounts, ids);
    }

    function _balanceOfBatch(address[] memory accounts, uint256[] memory ids) internal view returns (uint256[] memory) {
        require(accounts.length == ids.length, "ERC1155: accounts and ids length mismatch");
        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = _balanceOf(accounts[i], ids[i]);
        }

        return batchBalances;
    }

    function setApprovalForAll(address, bool) external pure override {
        revert("Approval not allowed for soulbound tokens");
    }

    function isApprovedForAll(address, address) external pure override returns (bool) {
        return false; // Approvals are not allowed for soulbound tokens
    }

    function safeTransferFrom(address, address, uint256, uint256, bytes memory) external pure override {
        revert("Transfers not allowed for soulbound tokens");
    }

    function safeBatchTransferFrom(address, address, uint256[] memory, uint256[] memory, bytes memory) external pure override {
        revert("Batch transfers not allowed for soulbound tokens");
    }

    function mint(address account, uint256 tokenId, uint256 amount, string calldata scout) external {
      revert("Minting by users currently on hold");
    }

    function mintTo(address account, uint256 tokenId, uint256 amount, string calldata scout) external onlyAdmin {
        _mintTo(account, tokenId, amount, scout);
    }

    function _mintTo(address account, uint256 tokenId, uint256 amount, string calldata scout) internal {
        require(account != address(0), "Invalid account address");
        require(_isValidUUID(scout), "Scout must be a valid UUID");

        // Check the tokenId exists
        _getBuilderIdForToken(tokenId);

        ImplementationStorage.Layout storage s = ImplementationStorage.layout();

        // Mint tokens
        s.balances[tokenId][account] += amount;

        // Update total supply
        s.totalSupply[tokenId] += amount;

        // Emit TransferSingle event
        emit TransferSingle(msg.sender, address(0), account, tokenId, amount);

        // Emit BuilderScouted event
        emit BuilderScouted(tokenId, amount, scout);
    }

    function getTokenPurchasePrice(uint256 tokenId, uint256 amount) external view returns (uint256) {
        return _getTokenPurchasePrice(tokenId, amount);
    }

    function _getTokenPurchasePrice(uint256 tokenId, uint256 amount) internal view returns (uint256) {
        uint256 priceIncrement = MemoryUtils.getUint256(MemoryUtils.PRICE_INCREMENT_SLOT);
        uint256 currentSupply = _totalSupply(tokenId);
        uint256 totalCost = 0;
        for (uint256 i = 0; i < amount; i++) {
            totalCost += (currentSupply + i + 1) * priceIncrement;
        }
        return totalCost;
    }

    function totalSupply(uint256 tokenId) external view returns (uint256) {
        return _totalSupply(tokenId);
    }

    function _totalSupply(uint256 tokenId) internal view returns (uint256) {
        return ImplementationStorage.layout().totalSupply[tokenId];
    }

    function getBuilderIdForToken(uint256 tokenId) external view returns (string memory) {
        return _getBuilderIdForToken(tokenId);
    }

    function _getBuilderIdForToken(uint256 tokenId) internal view returns (string memory) {
        string memory builderId = ImplementationStorage.layout().tokenToBuilderRegistry[tokenId];
        require(bytes(builderId).length > 0, "Token not yet allocated");
        return builderId;
    }

    function getTokenIdForBuilder(string calldata builderId) external view returns (uint256) {
        return _getTokenIdForBuilder(builderId);
    }

    function _getTokenIdForBuilder(string calldata builderId) internal view returns (uint256) {
        uint256 tokenId = ImplementationStorage.layout().builderToTokenRegistry[builderId];
        require(tokenId != 0, "Builder not registered");
        return tokenId;
    }

    function totalBuilderTokens() external view returns (uint256) {
        return _totalBuilderTokens();
    }

    function _totalBuilderTokens() internal view returns (uint256) {
        uint256 nextTokenId = MemoryUtils.getUint256(MemoryUtils.NEXT_TOKEN_ID_SLOT);
        return nextTokenId - 1;
    }

    function getPriceIncrement() external view returns (uint256) {
        return _getPriceIncrement();
    }

    function _getPriceIncrement() internal view returns (uint256) {
        return MemoryUtils.getUint256(MemoryUtils.PRICE_INCREMENT_SLOT);
    }

    function uri(uint256 _tokenId) external pure override returns (string memory) {
      return _tokenURI(_tokenId);
    }

    // OpenSea requires tokenURI
    function tokenURI(uint256 _tokenId) external pure returns (string memory) {
        return _tokenURI(_tokenId);
    }

    function _tokenURI(uint256 _tokenId) internal pure returns (string memory) {
      return string(abi.encodePacked("https://nft.scoutgame.xyz/seasons/2024-W40/beta/", _uint2str(_tokenId), "/artwork.png"));
    }

    // Utility function to convert uint to string
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }

        uint256 temp = _i;
        uint256 digits;

        // Count the number of digits in the number
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        // Create a byte array to store the characters of the number
        bytes memory buffer = new bytes(digits);

        // Extract each digit from the least significant to the most significant
        while (_i != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(_i % 10)));
            _i /= 10;
        }

        return string(buffer);
    }

    function isValidUUID(string memory uuid) external pure returns (bool) {
        return _isValidUUID(uuid);
    }

    function _isValidUUID(string memory uuid) internal pure returns (bool) {
        bytes memory uuidBytes = bytes(uuid);
        return uuidBytes.length == 36 &&
            uuidBytes[8] == "-" &&
            uuidBytes[13] == "-" &&
            uuidBytes[18] == "-" &&
            uuidBytes[23] == "-";
    }
}