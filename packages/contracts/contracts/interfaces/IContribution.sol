// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IContribution
 * @author Agent Anchor Team
 * @notice Interface for tracking human vs AI contribution ratios
 * @dev Enables documentation of human oversight in AI-assisted code
 */
interface IContribution {
    // ============ Events ============

    /**
     * @notice Emitted when contribution ratio is set
     * @param traceHash The trace this contribution is for
     * @param humanPercent Percentage of human contribution (0-100)
     * @param aiPercent Percentage of AI contribution (0-100)
     * @param notes Optional explanation
     */
    event ContributionSet(
        bytes32 indexed traceHash,
        uint8 humanPercent,
        uint8 aiPercent,
        string notes
    );

    /**
     * @notice Emitted with extended contribution data
     * @param traceHash The trace this contribution is for
     * @param humanPercent Percentage of human contribution
     * @param aiPercent Percentage of AI contribution
     * @param notes Explanation of the calculation
     * @param calculationMethod How the ratio was determined
     */
    event ContributionWithNotes(
        bytes32 indexed traceHash,
        uint8 humanPercent,
        uint8 aiPercent,
        string notes,
        string calculationMethod
    );

    // ============ Errors ============
    // Note: TraceNotFound and NotTraceCreator are defined in OwnershipTypes.sol

    /// @notice Thrown when percentages don't sum to 100
    error ContributionMustSumTo100(uint8 humanPercent, uint8 aiPercent);

    /// @notice Thrown when percentage is out of range (>100)
    error InvalidContributionRatio(uint8 percent);

    // ============ Functions ============

    /**
     * @notice Set contribution ratio for a trace
     * @param traceHash The trace hash to set contribution for
     * @param humanPercent Percentage of human contribution (0-100)
     * @param aiPercent Percentage of AI contribution (0-100)
     * @param notes Optional explanation of the calculation
     * @return success True if setting succeeded
     */
    function setContribution(
        bytes32 traceHash,
        uint8 humanPercent,
        uint8 aiPercent,
        string calldata notes
    ) external returns (bool success);

    /**
     * @notice Get contribution ratio for a trace
     * @param traceHash The trace hash to query
     * @return humanPercent Percentage of human contribution
     * @return aiPercent Percentage of AI contribution
     * @return hasContribution Whether contribution is set
     */
    function getContribution(
        bytes32 traceHash
    ) external view returns (
        uint8 humanPercent,
        uint8 aiPercent,
        bool hasContribution
    );
}
