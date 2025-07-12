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

describe("Token Purchase", () => {
    beforeEach(() => {
      // Setup: Create, verify property for token purchase tests
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Investment Property"),
        Cl.stringUtf8("Prime Location"),
        Cl.uint(1000000000), // 1000 STX property value
        Cl.uint(1000), // 1000 tokens
        Cl.uint(10000000) // 10 STX monthly rent
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
    });

    it("allows purchasing tokens from verified property", () => {
      const tokensToBuy = 250; // 25% of property
      const { result } = simnet.callPublicFn(contractName, "purchase-tokens", [
        Cl.uint(1),
        Cl.uint(tokensToBuy)
      ], address3);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("calculates token price correctly", () => {
      // Property value: 1000 STX, Total tokens: 1000 = 1 STX per token
      const tokensToBuy = 100;
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(tokensToBuy)], address3);
      
      // Check token holdings
      const { result } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          tokens: Cl.uint(tokensToBuy),
          "purchase-price": Cl.uint(100000000), // 100 STX total cost
          "acquired-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("updates available tokens after purchase", () => {
      const tokensToBuy = 300;
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(tokensToBuy)], address3);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-property-details", [Cl.uint(1)], address1);
      expect(result).toBeSome(
        Cl.tuple({
          owner: Cl.principal(address1),
          title: Cl.stringUtf8("Investment Property"),
          location: Cl.stringUtf8("Prime Location"),
          "property-value": Cl.uint(1000000000),
          "total-tokens": Cl.uint(1000),
          "available-tokens": Cl.uint(700), // 1000 - 300
          "monthly-rent": Cl.uint(10000000),
          verified: Cl.bool(true),
          active: Cl.bool(true),
          "created-at": Cl.uint(expect.any(Number)),
        })
      );
    });

    it("prevents purchasing from unverified property", () => {
      // Create unverified property
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Unverified Property"),
        Cl.stringUtf8("Location"),
        Cl.uint(500000000),
        Cl.uint(500),
        Cl.uint(5000000)
      ], address1);
      
      const { result } = simnet.callPublicFn(contractName, "purchase-tokens", [
        Cl.uint(2), // Unverified property
        Cl.uint(100)
      ], address3);
      
      expect(result).toBeErr(Cl.uint(108)); // err-not-verified
    });

    it("prevents purchasing zero tokens", () => {
      const { result } = simnet.callPublicFn(contractName, "purchase-tokens", [
        Cl.uint(1),
        Cl.uint(0) // Zero tokens
      ], address3);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents purchasing more tokens than available", () => {
      const { result } = simnet.callPublicFn(contractName, "purchase-tokens", [
        Cl.uint(1),
        Cl.uint(1500) // More than 1000 available
      ], address3);
      
      expect(result).toBeErr(Cl.uint(103)); // err-insufficient-tokens
    });

    it("prevents purchasing when contract is paused", () => {
      simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);
      
      const { result } = simnet.callPublicFn(contractName, "purchase-tokens", [
        Cl.uint(1),
        Cl.uint(100)
      ], address3);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents purchasing from non-existent property", () => {
      const { result } = simnet.callPublicFn(contractName, "purchase-tokens", [
        Cl.uint(999), // Non-existent property
        Cl.uint(100)
      ], address3);
      
      expect(result).toBeErr(Cl.uint(102)); // err-property-not-found
    });

    it("handles multiple token purchases by same user", () => {
      // First purchase
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(200)], address3);
      
      // Second purchase
      const { result } = simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(150)], address3);
      expect(result).toBeOk(Cl.bool(true));
      
      // Check combined holdings
      const { result: holdings } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      
      expect(holdings).toBeSome(
        Cl.tuple({
          tokens: Cl.uint(350), // 200 + 150
          "purchase-price": Cl.uint(350000000), // Combined purchase price
          "acquired-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("updates property holder count for new holders", () => {
      // First holder
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(100)], address3);
      
      // Second holder  
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(200)], address2);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-property-stats", [Cl.uint(1)], address1);
      expect(result).toBeSome(
        Cl.tuple({
          "total-holders": Cl.uint(2),
          "total-distributed": Cl.uint(0),
          "last-distribution": Cl.uint(0),
          "appreciation-rate": Cl.uint(0),
        })
      );
    });

    it("includes platform fee in token purchase", () => {
      const tokensToBuy = 100;
      // Token price: 1 STX, Platform fee: 2% of 100 STX = 2 STX
      // Total cost: 100 + 2 = 102 STX
      
      const { result } = simnet.callPublicFn(contractName, "purchase-tokens", [
        Cl.uint(1),
        Cl.uint(tokensToBuy)
      ], address3);
      
      expect(result).toBeOk(Cl.bool(true));
    });
  });

  describe("Rental Income Distribution", () => {
    beforeEach(() => {
      // Setup: Create property, verify, and have token holders
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Rental Property"),
        Cl.stringUtf8("Rental Location"),
        Cl.uint(1000000000), // 1000 STX
        Cl.uint(1000), // 1000 tokens
        Cl.uint(20000000) // 20 STX monthly rent
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      // Token holders
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(400)], address2); // 40%
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(300)], address3); // 30%
    });

    it("allows property owner to distribute rental income", () => {
      const distributionAmount = 20000000; // 20 STX
      const { result } = simnet.callPublicFn(contractName, "distribute-rental-income", [
        Cl.uint(1),
        Cl.uint(distributionAmount)
      ], address1);
      
      expect(result).toBeOk(Cl.uint(1)); // First distribution ID
    });

    it("calculates per-token distribution correctly", () => {
      const distributionAmount = 20000000; // 20 STX
      simnet.callPublicFn(contractName, "distribute-rental-income", [
        Cl.uint(1),
        Cl.uint(distributionAmount)
      ], address1);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-distribution-details", [
        Cl.uint(1),
        Cl.uint(1)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          "total-amount": Cl.uint(distributionAmount),
          "per-token-amount": Cl.uint(20000), // 20 STX / 1000 tokens = 20,000 microSTX per token
          "distribution-date": Cl.uint(simnet.blockHeight),
          "claimed-amount": Cl.uint(0),
        })
      );
    });

    it("prevents non-owner from distributing rental income", () => {
      const { result } = simnet.callPublicFn(contractName, "distribute-rental-income", [
        Cl.uint(1),
        Cl.uint(10000000)
      ], address2); // Not the property owner
      
      expect(result).toBeErr(Cl.uint(101)); // err-not-authorized
    });

    it("prevents distributing from unverified property", () => {
      // Create unverified property
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Unverified Rental"),
        Cl.stringUtf8("Location"),
        Cl.uint(500000000),
        Cl.uint(500),
        Cl.uint(5000000)
      ], address1);
      
      const { result } = simnet.callPublicFn(contractName, "distribute-rental-income", [
        Cl.uint(2), // Unverified property
        Cl.uint(5000000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(108)); // err-not-verified
    });

    it("prevents distributing zero amount", () => {
      const { result } = simnet.callPublicFn(contractName, "distribute-rental-income", [
        Cl.uint(1),
        Cl.uint(0) // Zero amount
      ], address1);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("updates property stats after distribution", () => {
      const distributionAmount = 15000000; // 15 STX
      simnet.callPublicFn(contractName, "distribute-rental-income", [
        Cl.uint(1),
        Cl.uint(distributionAmount)
      ], address1);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-property-stats", [Cl.uint(1)], address1);
      expect(result).toBeSome(
        Cl.tuple({
          "total-holders": Cl.uint(2),
          "total-distributed": Cl.uint(distributionAmount),
          "last-distribution": Cl.uint(simnet.blockHeight),
          "appreciation-rate": Cl.uint(0),
        })
      );
    });
  });

  describe("Rental Income Claims", () => {
    beforeEach(() => {
      // Setup: Create property, verify, buy tokens, distribute income
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Claim Property"),
        Cl.stringUtf8("Claim Location"),
        Cl.uint(1000000000),
        Cl.uint(1000),
        Cl.uint(20000000)
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      // Token purchases
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(250)], address2); // 25%
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(500)], address3); // 50%
      
      // Distribution
      simnet.callPublicFn(contractName, "distribute-rental-income", [
        Cl.uint(1),
        Cl.uint(20000000) // 20 STX
      ], address1);
    });

    it("allows token holder to claim rental income", () => {
      // address2 has 250 tokens, should get 250 * 20,000 = 5,000,000 microSTX (5 STX)
      const { result } = simnet.callPublicFn(contractName, "claim-rental-income", [
        Cl.uint(1), // property-id
        Cl.uint(1)  // distribution-id
      ], address2);
      
      expect(result).toBeOk(Cl.uint(5000000)); // 5 STX claimed
    });

    it("calculates claimable income correctly", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-claimable-income", [
        Cl.uint(1),
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      
      // address3 has 500 tokens, should get 500 * 20,000 = 10,000,000 microSTX (10 STX)
      expect(result).toBeOk(Cl.uint(10000000));
    });

    it("prevents non-token holder from claiming", () => {
      const { result } = simnet.callPublicFn(contractName, "claim-rental-income", [
        Cl.uint(1),
        Cl.uint(1)
      ], deployer); // Deployer has no tokens
      
      expect(result).toBeErr(Cl.uint(103)); // err-insufficient-tokens
    });

    it("prevents double claiming", () => {
      // First claim
      simnet.callPublicFn(contractName, "claim-rental-income", [Cl.uint(1), Cl.uint(1)], address2);
      
      // Second claim attempt
      const { result } = simnet.callPublicFn(contractName, "claim-rental-income", [
        Cl.uint(1),
        Cl.uint(1)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("returns zero for already claimed income", () => {
      // Claim first
      simnet.callPublicFn(contractName, "claim-rental-income", [Cl.uint(1), Cl.uint(1)], address2);
      
      // Check claimable amount after claim
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-claimable-income", [
        Cl.uint(1),
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeOk(Cl.uint(0));
    });

    it("records claim details correctly", () => {
      simnet.callPublicFn(contractName, "claim-rental-income", [Cl.uint(1), Cl.uint(1)], address2);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-claim-details", [
        Cl.uint(1),
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          amount: Cl.uint(5000000), // 5 STX
          "claimed-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("updates distribution claimed amount", () => {
      simnet.callPublicFn(contractName, "claim-rental-income", [Cl.uint(1), Cl.uint(1)], address2);
      simnet.callPublicFn(contractName, "claim-rental-income", [Cl.uint(1), Cl.uint(1)], address3);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-distribution-details", [
        Cl.uint(1),
        Cl.uint(1)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          "total-amount": Cl.uint(20000000),
          "per-token-amount": Cl.uint(20000),
          "distribution-date": Cl.uint(expect.any(Number)),
          "claimed-amount": Cl.uint(15000000), // 5 STX + 10 STX claimed
        })
      );
    });

    it("prevents claiming from non-existent distribution", () => {
      const { result } = simnet.callPublicFn(contractName, "claim-rental-income", [
        Cl.uint(1),
        Cl.uint(999) // Non-existent distribution
      ], address2);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("returns none for non-existent claim details", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-claim-details", [
        Cl.uint(1),
        Cl.uint(1),
        Cl.principal(deployer) // No claim made
      ], address1);
      
      expect(result).toBeNone();
    });
  });

  describe("Token Holdings Management", () => {
    beforeEach(() => {
      // Setup property for holdings tests
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Holdings Property"),
        Cl.stringUtf8("Holdings Location"),
        Cl.uint(2000000000), // 2000 STX
        Cl.uint(2000), // 2000 tokens
        Cl.uint(30000000) // 30 STX monthly rent
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
    });

    it("tracks individual token holdings correctly", () => {
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(600)], address2);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          tokens: Cl.uint(600),
          "purchase-price": Cl.uint(600000000), // 600 STX (1 STX per token)
          "acquired-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("returns none for non-holder", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(1),
        Cl.principal(address3) // No tokens purchased
      ], address1);
      
      expect(result).toBeNone();
    });

    it("accumulates holdings from multiple purchases", () => {
      // First purchase
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(300)], address2);
      
      // Second purchase
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(400)], address2);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          tokens: Cl.uint(700), // 300 + 400
          "purchase-price": Cl.uint(700000000), // Combined cost
          "acquired-at": Cl.uint(simnet.blockHeight), // Latest purchase time
        })
      );
    });

    it("tracks multiple holders separately", () => {
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(500)], address2);
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(800)], address3);
      
      // Check first holder
      const { result: holder1 } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(holder1).toBeSome(
        Cl.tuple({
          tokens: Cl.uint(500),
          "purchase-price": Cl.uint(500000000),
          "acquired-at": Cl.uint(simnet.blockHeight - 1),
        })
      );
      
      // Check second holder
      const { result: holder2 } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      
      expect(holder2).toBeSome(
        Cl.tuple({
          tokens: Cl.uint(800),
          "purchase-price": Cl.uint(800000000),
          "acquired-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("calculates ownership percentage correctly", () => {
      // Purchase 25% of tokens (500 out of 2000)
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(500)], address2);
      
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-ownership-percentage", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeOk(Cl.uint(2500)); // 25% = 2500 basis points
    });

    it("handles fractional ownership percentages", () => {
      // Purchase 33 out of 2000 tokens = 1.65%
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(33)], address3);
      
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-ownership-percentage", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      
      expect(result).toBeOk(Cl.uint(165)); // 1.65% = 165 basis points
    });

    it("returns error for non-holder ownership calculation", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-ownership-percentage", [
        Cl.uint(1),
        Cl.principal(deployer) // No tokens purchased
      ], address1);
      
      expect(result).toBeErr(Cl.uint(0));
    });

    it("returns error for non-existent property ownership calculation", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-ownership-percentage", [
        Cl.uint(999), // Non-existent property
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(0));
    });
  });