import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const address3 = accounts.get("wallet_3")!;
const deployer = accounts.get("deployer")!;

const contractName = "property-share";

describe("PropertyShare Contract Tests", () => {
  beforeEach(() => {
    // Reset simnet state before each test
    simnet.mineEmptyBlocks(1);
  });

  describe("Contract Initialization", () => {
    it("ensures simnet is well initialised", () => {
      expect(simnet.blockHeight).toBeDefined();
    });

    it("initializes with correct default values", () => {
      const { result: totalProperties } = simnet.callReadOnlyFn(contractName, "get-total-properties", [], deployer);
      expect(totalProperties).toBeUint(0);
    });

    it("sets correct contract owner", () => {
      // Owner should be able to add verifiers
      const { result } = simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address1)], deployer);
      expect(result).toBeOk(Cl.bool(true));
    });
  });

  describe("Administrative Functions", () => {
    it("allows owner to add authorized verifier", () => {
      const { result } = simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address1)], deployer);
      expect(result).toBeOk(Cl.bool(true));

      const { result: isVerifier } = simnet.callReadOnlyFn(contractName, "is-authorized-verifier", [Cl.principal(address1)], deployer);
      expect(isVerifier).toBeBool(true);
    });

    it("prevents non-owner from adding verifier", () => {
      const { result } = simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], address1);
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("allows owner to remove authorized verifier", () => {
      // First add verifier
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address1)], deployer);
      
      // Then remove
      const { result } = simnet.callPublicFn(contractName, "remove-authorized-verifier", [Cl.principal(address1)], deployer);
      expect(result).toBeOk(Cl.bool(true));

      const { result: isVerifier } = simnet.callReadOnlyFn(contractName, "is-authorized-verifier", [Cl.principal(address1)], deployer);
      expect(isVerifier).toBeBool(false);
    });

    it("allows owner to set platform fee", () => {
      const newFee = 300; // 3%
      const { result } = simnet.callPublicFn(contractName, "set-platform-fee", [Cl.uint(newFee)], deployer);
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents setting platform fee above 10%", () => {
      const invalidFee = 1100; // 11%
      const { result } = simnet.callPublicFn(contractName, "set-platform-fee", [Cl.uint(invalidFee)], deployer);
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents non-owner from setting platform fee", () => {
      const { result } = simnet.callPublicFn(contractName, "set-platform-fee", [Cl.uint(300)], address1);
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("allows owner to toggle contract pause", () => {
      const { result } = simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents non-owner from toggling pause", () => {
      const { result } = simnet.callPublicFn(contractName, "toggle-contract-pause", [], address1);
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("allows owner to withdraw platform fees", () => {
      const { result } = simnet.callPublicFn(contractName, "withdraw-platform-fees", [], deployer);
      expect(result).toBeOk(Cl.bool(true));
    });
  });

  describe("Property Creation", () => {
    it("creates property with valid parameters", () => {
      const { result } = simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Luxury Apartment"),
        Cl.stringUtf8("123 Main St, New York, NY"),
        Cl.uint(1000000000), // 1000 STX property value
        Cl.uint(1000), // 1000 tokens
        Cl.uint(10000000) // 10 STX monthly rent
      ], address1);
      
      expect(result).toBeOk(Cl.uint(1)); // First property ID should be 1
    });

    it("creates multiple properties", () => {
      const { result: property1 } = simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Property 1"),
        Cl.stringUtf8("Location 1"),
        Cl.uint(500000000), // 500 STX
        Cl.uint(500),
        Cl.uint(5000000) // 5 STX
      ], address1);
      expect(property1).toBeOk(Cl.uint(1));

      const { result: property2 } = simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Property 2"),
        Cl.stringUtf8("Location 2"),
        Cl.uint(800000000), // 800 STX
        Cl.uint(800),
        Cl.uint(8000000) // 8 STX
      ], address2);
      expect(property2).toBeOk(Cl.uint(2));

      const { result: totalProperties } = simnet.callReadOnlyFn(contractName, "get-total-properties", [], deployer);
      expect(totalProperties).toBeUint(2);
    });

    it("prevents creating property with zero value", () => {
      const { result } = simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Invalid Property"),
        Cl.stringUtf8("Location"),
        Cl.uint(0), // Invalid zero value
        Cl.uint(1000),
        Cl.uint(10000000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents creating property with zero tokens", () => {
      const { result } = simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Invalid Property"),
        Cl.stringUtf8("Location"),
        Cl.uint(1000000000),
        Cl.uint(0), // Invalid zero tokens
        Cl.uint(10000000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents creating property with too many tokens", () => {
      const { result } = simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Invalid Property"),
        Cl.stringUtf8("Location"),
        Cl.uint(1000000000),
        Cl.uint(15000), // Exceeds max 10,000 tokens
        Cl.uint(10000000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents creating property when contract is paused", () => {
      // Pause contract
      simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);
      
      const { result } = simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Paused Property"),
        Cl.stringUtf8("Location"),
        Cl.uint(1000000000),
        Cl.uint(1000),
        Cl.uint(10000000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("retrieves property details correctly", () => {
      const title = "Test Property";
      const location = "Test Location";
      const propertyValue = 1000000000;
      const totalTokens = 1000;
      const monthlyRent = 10000000;
      
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8(title),
        Cl.stringUtf8(location),
        Cl.uint(propertyValue),
        Cl.uint(totalTokens),
        Cl.uint(monthlyRent)
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-property-details", [Cl.uint(1)], address1);
      expect(result).toBeSome(
        Cl.tuple({
          owner: Cl.principal(address1),
          title: Cl.stringUtf8(title),
          location: Cl.stringUtf8(location),
          "property-value": Cl.uint(propertyValue),
          "total-tokens": Cl.uint(totalTokens),
          "available-tokens": Cl.uint(totalTokens),
          "monthly-rent": Cl.uint(monthlyRent),
          verified: Cl.bool(false),
          active: Cl.bool(false),
          "created-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("returns none for non-existent property", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-property-details", [Cl.uint(999)], address1);
      expect(result).toBeNone();
    });

    it("initializes property stats correctly", () => {
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Test Property"),
        Cl.stringUtf8("Location"),
        Cl.uint(1000000000),
        Cl.uint(1000),
        Cl.uint(10000000)
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-property-stats", [Cl.uint(1)], address1);
      expect(result).toBeSome(
        Cl.tuple({
          "total-holders": Cl.uint(0),
          "total-distributed": Cl.uint(0),
          "last-distribution": Cl.uint(0),
          "appreciation-rate": Cl.uint(0),
        })
      );
    });
  });

  describe("Property Verification", () => {
    beforeEach(() => {
      // Create a property and add verifier for verification tests
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Test Property"),
        Cl.stringUtf8("Test Location"),
        Cl.uint(1000000000),
        Cl.uint(1000),
        Cl.uint(10000000)
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
    });

    it("allows authorized verifier to verify property", () => {
      const { result } = simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      expect(result).toBeOk(Cl.bool(true));
      
      // Check property is now verified and active
      const { result: property } = simnet.callReadOnlyFn(contractName, "get-property-details", [Cl.uint(1)], address1);
      expect(property).toBeSome(
        Cl.tuple({
          owner: Cl.principal(address1),
          title: Cl.stringUtf8("Test Property"),
          location: Cl.stringUtf8("Test Location"),
          "property-value": Cl.uint(1000000000),
          "total-tokens": Cl.uint(1000),
          "available-tokens": Cl.uint(1000),
          "monthly-rent": Cl.uint(10000000),
          verified: Cl.bool(true),
          active: Cl.bool(true),
          "created-at": Cl.uint(simnet.blockHeight - 1),
        })
      );
    });

    it("prevents non-authorized verifier from verifying", () => {
      const { result } = simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address3);
      expect(result).toBeErr(Cl.uint(101)); // err-not-authorized
    });

    it("prevents verifying non-existent property", () => {
      const { result } = simnet.callPublicFn(contractName, "verify-property", [Cl.uint(999)], address2);
      expect(result).toBeErr(Cl.uint(102)); // err-property-not-found
    });

    it("prevents double verification", () => {
      // First verification
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      // Second verification attempt
      const { result } = simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      expect(result).toBeErr(Cl.uint(107)); // err-already-verified
    });
  });

  describe("Property Value Updates", () => {
    beforeEach(() => {
      // Setup: Create property, add verifier, and verify
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Appreciation Property"),
        Cl.stringUtf8("Growth Location"),
        Cl.uint(1000000000), // 1000 STX initial value
        Cl.uint(1000),
        Cl.uint(10000000)
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
    });

    it("allows authorized verifier to update property value", () => {
      const newValue = 1200000000; // 1200 STX (20% appreciation)
      const { result } = simnet.callPublicFn(contractName, "update-property-value", [
        Cl.uint(1),
        Cl.uint(newValue)
      ], address2);
      
      expect(result).toBeOk(Cl.bool(true));
      
      // Check updated property value
      const { result: property } = simnet.callReadOnlyFn(contractName, "get-property-details", [Cl.uint(1)], address1);
      expect(property).toBeSome(
        Cl.tuple({
          owner: Cl.principal(address1),
          title: Cl.stringUtf8("Appreciation Property"),
          location: Cl.stringUtf8("Growth Location"),
          "property-value": Cl.uint(newValue),
          "total-tokens": Cl.uint(1000),
          "available-tokens": Cl.uint(1000),
          "monthly-rent": Cl.uint(10000000),
          verified: Cl.bool(true),
          active: Cl.bool(true),
          "created-at": Cl.uint(expect.any(Number)),
        })
      );
    });

    it("calculates appreciation rate correctly", () => {
      const newValue = 1500000000; // 1500 STX (50% appreciation)
      simnet.callPublicFn(contractName, "update-property-value", [Cl.uint(1), Cl.uint(newValue)], address2);
      
      // Check appreciation rate in stats (50% = 5000 basis points)
      const { result: stats } = simnet.callReadOnlyFn(contractName, "get-property-stats", [Cl.uint(1)], address1);
      expect(stats).toBeSome(
        Cl.tuple({
          "total-holders": Cl.uint(0),
          "total-distributed": Cl.uint(0),
          "last-distribution": Cl.uint(0),
          "appreciation-rate": Cl.uint(5000), // 50% in basis points
        })
      );
    });

    it("prevents non-authorized verifier from updating value", () => {
      const { result } = simnet.callPublicFn(contractName, "update-property-value", [
        Cl.uint(1),
        Cl.uint(1200000000)
      ], address3);
      
      expect(result).toBeErr(Cl.uint(101)); // err-not-authorized
    });

    it("prevents updating with zero value", () => {
      const { result } = simnet.callPublicFn(contractName, "update-property-value", [
        Cl.uint(1),
        Cl.uint(0)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents updating non-existent property", () => {
      const { result } = simnet.callPublicFn(contractName, "update-property-value", [
        Cl.uint(999),
        Cl.uint(1200000000)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(102)); // err-property-not-found
    });

    it("handles depreciation correctly", () => {
      const lowerValue = 800000000; // 800 STX (20% depreciation)
      simnet.callPublicFn(contractName, "update-property-value", [Cl.uint(1), Cl.uint(lowerValue)], address2);
      
      // Appreciation rate should be 0 for depreciation
      const { result: stats } = simnet.callReadOnlyFn(contractName, "get-property-stats", [Cl.uint(1)], address1);
      expect(stats).toBeSome(
        Cl.tuple({
          "total-holders": Cl.uint(0),
          "total-distributed": Cl.uint(0),
          "last-distribution": Cl.uint(0),
          "appreciation-rate": Cl.uint(0),
        })
      );
    });
  });

  describe("Read-only Functions", () => {
    it("calculates ownership percentage correctly", () => {
      // Create and verify property
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Test Property"),
        Cl.stringUtf8("Location"),
        Cl.uint(1000000000),
        Cl.uint(1000), // 1000 total tokens
        Cl.uint(10000000)
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      // Purchase tokens first
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(250)], address3); // 25% ownership
      
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-ownership-percentage", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      
      expect(result).toBeOk(Cl.uint(2500)); // 25% = 2500 basis points
    });

    it("returns error for non-existent property in ownership calculation", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-ownership-percentage", [
        Cl.uint(999),
        Cl.principal(address1)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(0));
    });

    it("returns error for non-holder in ownership calculation", () => {
      // Create property but don't purchase tokens
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Test Property"),
        Cl.stringUtf8("Location"),
        Cl.uint(1000000000),
        Cl.uint(1000),
        Cl.uint(10000000)
      ], address1);
      
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-ownership-percentage", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(0));
    });
  });
});