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

describe("Secondary Market Trading", () => {
    beforeEach(() => {
      // Setup: Create property, verify, and establish token holders
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Trading Property"),
        Cl.stringUtf8("Trading Location"),
        Cl.uint(1000000000), // 1000 STX
        Cl.uint(1000), // 1000 tokens
        Cl.uint(15000000) // 15 STX monthly rent
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      // Initial token holders
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(400)], address2); // 40%
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(300)], address3); // 30%
    });

    it("allows token holder to list tokens for sale", () => {
      const tokensToSell = 150;
      const pricePerToken = 1200000; // 1.2 STX per token (20% premium)
      
      const { result } = simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(tokensToSell),
        Cl.uint(pricePerToken)
      ], address2);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents listing more tokens than owned", () => {
      const { result } = simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(500), // address2 only has 400 tokens
        Cl.uint(1200000)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(103)); // err-insufficient-tokens
    });

    it("prevents listing zero tokens", () => {
      const { result } = simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(0), // Zero tokens
        Cl.uint(1200000)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents listing with zero price", () => {
      const { result } = simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(100),
        Cl.uint(0) // Zero price
      ], address2);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents duplicate listings by same user", () => {
      // First listing
      simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(100),
        Cl.uint(1200000)
      ], address2);
      
      // Second listing attempt
      const { result } = simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(200),
        Cl.uint(1300000)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents listing from unverified property", () => {
      // Create unverified property
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Unverified Trading"),
        Cl.stringUtf8("Location"),
        Cl.uint(500000000),
        Cl.uint(500),
        Cl.uint(5000000)
      ], address1);
      
      const { result } = simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(2), // Unverified property
        Cl.uint(100),
        Cl.uint(1000000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(108)); // err-not-verified
    });

    it("retrieves listing details correctly", () => {
      const tokensToSell = 200;
      const pricePerToken = 1500000; // 1.5 STX per token
      
      simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(tokensToSell),
        Cl.uint(pricePerToken)
      ], address2);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-token-listing", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          "tokens-for-sale": Cl.uint(tokensToSell),
          "price-per-token": Cl.uint(pricePerToken),
          "listed-at": Cl.uint(simnet.blockHeight),
          active: Cl.bool(true),
        })
      );
    });

    it("allows canceling active listing", () => {
      // Create listing
      simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(150),
        Cl.uint(1200000)
      ], address2);
      
      // Cancel listing
      const { result } = simnet.callPublicFn(contractName, "cancel-listing", [Cl.uint(1)], address2);
      expect(result).toBeOk(Cl.bool(true));
      
      // Check listing is deactivated
      const { result: listing } = simnet.callReadOnlyFn(contractName, "get-token-listing", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(listing).toBeSome(
        Cl.tuple({
          "tokens-for-sale": Cl.uint(150),
          "price-per-token": Cl.uint(1200000),
          "listed-at": Cl.uint(expect.any(Number)),
          active: Cl.bool(false),
        })
      );
    });

    it("prevents canceling non-existent listing", () => {
      const { result } = simnet.callPublicFn(contractName, "cancel-listing", [Cl.uint(1)], address3);
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents listing when contract is paused", () => {
      simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);
      
      const { result } = simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(100),
        Cl.uint(1200000)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });
  });

  describe("Token Purchase from Secondary Market", () => {
    beforeEach(() => {
      // Setup: Create property, verify, establish holders, and create listing
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Market Property"),
        Cl.stringUtf8("Market Location"),
        Cl.uint(1000000000),
        Cl.uint(1000),
        Cl.uint(15000000)
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      // Token holders
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(500)], address2);
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(300)], address3);
      
      // Create listing
      simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(200), // 200 tokens for sale
        Cl.uint(1200000) // 1.2 STX per token
      ], address2);
    });

    it("allows buying listed tokens", () => {
      const tokensToBuy = 100;
      const { result } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2), // seller
        Cl.uint(tokensToBuy)
      ], address3);
      
      expect(result).toBeOk(Cl.uint(1)); // First trade ID
    });

    it("updates buyer holdings after purchase", () => {
      const tokensToBuy = 150;
      simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(tokensToBuy)
      ], address3);
      
      // Check buyer's updated holdings (300 + 150 = 450)
      const { result } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          tokens: Cl.uint(450),
          "purchase-price": Cl.uint(480000000), // Original 300 STX + 180 STX for 150 tokens at 1.2 STX each
          "acquired-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("updates seller holdings after sale", () => {
      const tokensToBuy = 100;
      simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(tokensToBuy)
      ], address3);
      
      // Check seller's reduced holdings (500 - 100 = 400)
      const { result } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          tokens: Cl.uint(400),
          "purchase-price": Cl.uint(500000000), // Original purchase price unchanged
          "acquired-at": Cl.uint(expect.any(Number)),
        })
      );
    });

    it("records trade history correctly", () => {
      const tokensToBuy = 75;
      simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(tokensToBuy)
      ], address3);
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-trade-history", [
        Cl.uint(1),
        Cl.uint(1)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          seller: Cl.principal(address2),
          buyer: Cl.principal(address3),
          "tokens-traded": Cl.uint(tokensToBuy),
          "price-per-token": Cl.uint(1200000),
          "total-amount": Cl.uint(90000000), // 75 * 1.2 STX = 90 STX
          "traded-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("handles partial listing fulfillment", () => {
      const tokensToBuy = 50; // Less than 200 available
      simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(tokensToBuy)
      ], address3);
      
      // Check listing still active with reduced tokens
      const { result } = simnet.callReadOnlyFn(contractName, "get-token-listing", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          "tokens-for-sale": Cl.uint(150), // 200 - 50
          "price-per-token": Cl.uint(1200000),
          "listed-at": Cl.uint(expect.any(Number)),
          active: Cl.bool(true),
        })
      );
    });

    it("deactivates listing when fully purchased", () => {
      const tokensToBuy = 200; // All available tokens
      simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(tokensToBuy)
      ], address3);
      
      // Check listing is deactivated
      const { result } = simnet.callReadOnlyFn(contractName, "get-token-listing", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(result).toBeSome(
        Cl.tuple({
          "tokens-for-sale": Cl.uint(0),
          "price-per-token": Cl.uint(1200000),
          "listed-at": Cl.uint(expect.any(Number)),
          active: Cl.bool(false),
        })
      );
    });

    it("prevents buying more tokens than listed", () => {
      const { result } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(300) // More than 200 available
      ], address3);
      
      expect(result).toBeErr(Cl.uint(103)); // err-insufficient-tokens
    });

    it("prevents buying zero tokens", () => {
      const { result } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(0) // Zero tokens
      ], address3);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents seller from buying own tokens", () => {
      const { result } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2), // seller
        Cl.uint(100)
      ], address2); // Same as seller
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("prevents buying from inactive listing", () => {
      // Cancel listing first
      simnet.callPublicFn(contractName, "cancel-listing", [Cl.uint(1)], address2);
      
      const { result } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(100)
      ], address3);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("includes platform fee in secondary market trades", () => {
      const tokensToBuy = 100;
      // Total cost: 100 * 1.2 STX = 120 STX
      // Platform fee: 2% of 120 STX = 2.4 STX
      // Seller receives: 120 - 2.4 = 117.6 STX
      
      const { result } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(tokensToBuy)
      ], address3);
      
      expect(result).toBeOk(Cl.uint(1));
    });

    it("updates property holder count for new buyers", () => {
      // Buy tokens with a new address that doesn't have any tokens yet
      simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(100)
      ], deployer); // New token holder
      
      const { result } = simnet.callReadOnlyFn(contractName, "get-property-stats", [Cl.uint(1)], address1);
      expect(result).toBeSome(
        Cl.tuple({
          "total-holders": Cl.uint(3), // address2, address3, deployer
          "total-distributed": Cl.uint(0),
          "last-distribution": Cl.uint(0),
          "appreciation-rate": Cl.uint(0),
        })
      );
    });

    it("prevents buying when contract is paused", () => {
      simnet.callPublicFn(contractName, "toggle-contract-pause", [], deployer);
      
      const { result } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(100)
      ], address3);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });
  });

  describe("Emergency Controls", () => {
    beforeEach(() => {
      // Setup: Create property and establish secondary market
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Emergency Property"),
        Cl.stringUtf8("Emergency Location"),
        Cl.uint(800000000),
        Cl.uint(800),
        Cl.uint(12000000)
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(300)], address2);
      simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(100),
        Cl.uint(1500000)
      ], address2);
    });

    it("allows owner to emergency delist", () => {
      const { result } = simnet.callPublicFn(contractName, "emergency-delist", [
        Cl.uint(1),
        Cl.principal(address2)
      ], deployer);
      
      expect(result).toBeOk(Cl.bool(true));
      
      // Check listing is deactivated
      const { result: listing } = simnet.callReadOnlyFn(contractName, "get-token-listing", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1);
      
      expect(listing).toBeSome(
        Cl.tuple({
          "tokens-for-sale": Cl.uint(100),
          "price-per-token": Cl.uint(1500000),
          "listed-at": Cl.uint(expect.any(Number)),
          active: Cl.bool(false),
        })
      );
    });

    it("prevents non-owner from emergency delisting", () => {
      const { result } = simnet.callPublicFn(contractName, "emergency-delist", [
        Cl.uint(1),
        Cl.principal(address2)
      ], address1); // Not the contract owner
      
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("prevents emergency delisting non-existent listing", () => {
      const { result } = simnet.callPublicFn(contractName, "emergency-delist", [
        Cl.uint(1),
        Cl.principal(address3) // No listing
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(105)); // err-invalid-parameter
    });

    it("allows contract owner to withdraw platform fees", () => {
      // Generate some platform fees first through token purchases
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(100)], address3);
      
      const { result } = simnet.callPublicFn(contractName, "withdraw-platform-fees", [], deployer);
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents non-owner from withdrawing platform fees", () => {
      const { result } = simnet.callPublicFn(contractName, "withdraw-platform-fees", [], address1);
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });
  });

  describe("Integration Tests", () => {
    it("complete property lifecycle with all features", () => {
      // 1. Create property
      const { result: propertyResult } = simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Complete Lifecycle Property"),
        Cl.stringUtf8("Premium Downtown Location"),
        Cl.uint(2000000000), // 2000 STX value
        Cl.uint(2000), // 2000 tokens
        Cl.uint(40000000) // 40 STX monthly rent
      ], address1);
      expect(propertyResult).toBeOk(Cl.uint(1));
      
      // 2. Add verifier and verify property
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      const { result: verifyResult } = simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      expect(verifyResult).toBeOk(Cl.bool(true));
      
      // 3. Multiple investors purchase tokens
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(600)], address2); // 30%
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(800)], address3); // 40%
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(400)], deployer); // 20%
      
      // 4. Property owner distributes rental income
      const { result: distributionResult } = simnet.callPublicFn(contractName, "distribute-rental-income", [
        Cl.uint(1),
        Cl.uint(40000000) // 40 STX
      ], address1);
      expect(distributionResult).toBeOk(Cl.uint(1));
      
      // 5. Token holders claim their rental income
      const { result: claim1 } = simnet.callPublicFn(contractName, "claim-rental-income", [Cl.uint(1), Cl.uint(1)], address2);
      expect(claim1).toBeOk(Cl.uint(12000000)); // 30% of 40 STX = 12 STX
      
      const { result: claim2 } = simnet.callPublicFn(contractName, "claim-rental-income", [Cl.uint(1), Cl.uint(1)], address3);
      expect(claim2).toBeOk(Cl.uint(16000000)); // 40% of 40 STX = 16 STX
      
      // 6. Secondary market trading
      simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(200), // Sell part of holdings
        Cl.uint(1100000) // 10% premium
      ], address2);
      
      const { result: tradeResult } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2),
        Cl.uint(200)
      ], address3);
      expect(tradeResult).toBeOk(Cl.uint(1));
      
      // 7. Property appreciation
      const { result: appreciationResult } = simnet.callPublicFn(contractName, "update-property-value", [
        Cl.uint(1),
        Cl.uint(2400000000) // 20% appreciation
      ], address2);
      expect(appreciationResult).toBeOk(Cl.bool(true));
      
      // 8. Verify final state
      const { result: finalStats } = simnet.callReadOnlyFn(contractName, "get-property-stats", [Cl.uint(1)], address1);
      expect(finalStats).toBeSome(
        Cl.tuple({
          "total-holders": Cl.uint(3),
          "total-distributed": Cl.uint(40000000),
          "last-distribution": Cl.uint(expect.any(Number)),
          "appreciation-rate": Cl.uint(2000), // 20% = 2000 basis points
        })
      );
    });

    it("handles multiple properties with different characteristics", () => {
      // Create different types of properties
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Luxury Apartment"),
        Cl.stringUtf8("Manhattan"),
        Cl.uint(5000000000), // High value
        Cl.uint(5000),
        Cl.uint(100000000) // High rent
      ], address1);
      
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Suburban House"),
        Cl.stringUtf8("Queens"),
        Cl.uint(800000000), // Lower value
        Cl.uint(800),
        Cl.uint(15000000) // Lower rent
      ], address2);
      
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Commercial Space"),
        Cl.stringUtf8("Brooklyn"),
        Cl.uint(3000000000), // Medium value
        Cl.uint(3000),
        Cl.uint(60000000) // Medium rent
      ], address3);
      
      // Verify all properties
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(2)], address2);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(3)], address2);
      
      // Different investment patterns
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(1000)], deployer); // 20% of luxury
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(2), Cl.uint(400)], deployer); // 50% of suburban
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(3), Cl.uint(1500)], deployer); // 50% of commercial
      
      // Verify total properties
      const { result: totalProperties } = simnet.callReadOnlyFn(contractName, "get-total-properties", [], deployer);
      expect(totalProperties).toBeUint(3);
    });

    it("handles edge cases and error scenarios", () => {
      // Create minimal property
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Minimal Property"),
        Cl.stringUtf8("Basic Location"),
        Cl.uint(1000000), // 1 STX minimum value
        Cl.uint(1), // 1 token
        Cl.uint(1000000) // 1 STX rent
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      // Purchase the single token
      const { result } = simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(1)], address3);
      expect(result).toBeOk(Cl.bool(true));
      
      // Verify ownership percentage is 100%
      const { result: ownership } = simnet.callReadOnlyFn(contractName, "calculate-ownership-percentage", [
        Cl.uint(1),
        Cl.principal(address3)
      ], address1);
      expect(ownership).toBeOk(Cl.uint(10000)); // 100% = 10000 basis points
      
      // Try to purchase more tokens (should fail)
      const { result: failedPurchase } = simnet.callPublicFn(contractName, "purchase-tokens", [
        Cl.uint(1),
        Cl.uint(1)
      ], address2);
      expect(failedPurchase).toBeErr(Cl.uint(103)); // err-insufficient-tokens
    });

    it("verifies portfolio calculation placeholder", () => {
      // Test the portfolio calculation function (currently returns 0)
      const { result } = simnet.callReadOnlyFn(contractName, "calculate-portfolio-value", [Cl.principal(address1)], address1);
      expect(result).toBeOk(Cl.uint(0));
    });

    it("handles maximum property token limit", () => {
      // Create property with maximum tokens
      const { result } = simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Maximum Token Property"),
        Cl.stringUtf8("Max Location"),
        Cl.uint(10000000000), // 10,000 STX
        Cl.uint(10000), // Maximum 10,000 tokens
        Cl.uint(200000000) // 200 STX rent
      ], address1);
      
      expect(result).toBeOk(Cl.uint(1));
      
      // Verify property details
      const { result: property } = simnet.callReadOnlyFn(contractName, "get-property-details", [Cl.uint(1)], address1);
      expect(property).toBeSome(
        Cl.tuple({
          owner: Cl.principal(address1),
          title: Cl.stringUtf8("Maximum Token Property"),
          location: Cl.stringUtf8("Max Location"),
          "property-value": Cl.uint(10000000000),
          "total-tokens": Cl.uint(10000),
          "available-tokens": Cl.uint(10000),
          "monthly-rent": Cl.uint(200000000),
          verified: Cl.bool(false),
          active: Cl.bool(false),
          "created-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("handles complex secondary market scenarios", () => {
      // Create property and establish multiple token holders
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Complex Trading Property"),
        Cl.stringUtf8("Trading Hub"),
        Cl.uint(3000000000), // 3000 STX
        Cl.uint(3000), // 3000 tokens
        Cl.uint(50000000) // 50 STX rent
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      // Multiple investors
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(1000)], address2);
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(800)], address3);
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(600)], deployer);
      
      // Multiple listings
      simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(300),
        Cl.uint(1100000) // 10% premium
      ], address2);
      
      simnet.callPublicFn(contractName, "list-tokens-for-sale", [
        Cl.uint(1),
        Cl.uint(200),
        Cl.uint(950000) // 5% discount
      ], address3);
      
      // Cross-trading between holders
      const { result: trade1 } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address3), // Buy from address3 (discount price)
        Cl.uint(150)
      ], deployer);
      expect(trade1).toBeOk(Cl.uint(1));
      
      const { result: trade2 } = simnet.callPublicFn(contractName, "buy-listed-tokens", [
        Cl.uint(1),
        Cl.principal(address2), // Buy from address2 (premium price)
        Cl.uint(100)
      ], address3);
      expect(trade2).toBeOk(Cl.uint(2));
      
      // Verify multiple trade history entries
      const { result: tradeHistory1 } = simnet.callReadOnlyFn(contractName, "get-trade-history", [
        Cl.uint(1),
        Cl.uint(1)
      ], address1);
      expect(tradeHistory1).toBeSome(
        Cl.tuple({
          seller: Cl.principal(address3),
          buyer: Cl.principal(deployer),
          "tokens-traded": Cl.uint(150),
          "price-per-token": Cl.uint(950000),
          "total-amount": Cl.uint(142500000), // 150 * 0.95 STX
          "traded-at": Cl.uint(expect.any(Number)),
        })
      );
      
      const { result: tradeHistory2 } = simnet.callReadOnlyFn(contractName, "get-trade-history", [
        Cl.uint(1),
        Cl.uint(2)
      ], address1);
      expect(tradeHistory2).toBeSome(
        Cl.tuple({
          seller: Cl.principal(address2),
          buyer: Cl.principal(address3),
          "tokens-traded": Cl.uint(100),
          "price-per-token": Cl.uint(1100000),
          "total-amount": Cl.uint(110000000), // 100 * 1.1 STX
          "traded-at": Cl.uint(expect.any(Number)),
        })
      );
    });

    it("validates read-only function responses for non-existent data", () => {
      // Test all read-only functions with non-existent IDs
      const { result: nonExistentProperty } = simnet.callReadOnlyFn(contractName, "get-property-details", [Cl.uint(999)], address1);
      expect(nonExistentProperty).toBeNone();
      
      const { result: nonExistentStats } = simnet.callReadOnlyFn(contractName, "get-property-stats", [Cl.uint(999)], address1);
      expect(nonExistentStats).toBeNone();
      
      const { result: nonExistentHoldings } = simnet.callReadOnlyFn(contractName, "get-token-holdings", [
        Cl.uint(999),
        Cl.principal(address1)
      ], address1);
      expect(nonExistentHoldings).toBeNone();
      
      const { result: nonExistentListing } = simnet.callReadOnlyFn(contractName, "get-token-listing", [
        Cl.uint(999),
        Cl.principal(address1)
      ], address1);
      expect(nonExistentListing).toBeNone();
      
      const { result: nonExistentTrade } = simnet.callReadOnlyFn(contractName, "get-trade-history", [
        Cl.uint(999),
        Cl.uint(999)
      ], address1);
      expect(nonExistentTrade).toBeNone();
      
      const { result: nonExistentDistribution } = simnet.callReadOnlyFn(contractName, "get-distribution-details", [
        Cl.uint(999),
        Cl.uint(999)
      ], address1);
      expect(nonExistentDistribution).toBeNone();
      
      const { result: nonExistentClaim } = simnet.callReadOnlyFn(contractName, "get-claim-details", [
        Cl.uint(999),
        Cl.uint(999),
        Cl.principal(address1)
      ], address1);
      expect(nonExistentClaim).toBeNone();
    });

    it("handles platform fee accumulation and withdrawal", () => {
      // Create property and make transactions to accumulate fees
      simnet.callPublicFn(contractName, "create-property", [
        Cl.stringUtf8("Fee Test Property"),
        Cl.stringUtf8("Fee Location"),
        Cl.uint(1000000000),
        Cl.uint(1000),
        Cl.uint(20000000)
      ], address1);
      
      simnet.callPublicFn(contractName, "add-authorized-verifier", [Cl.principal(address2)], deployer);
      simnet.callPublicFn(contractName, "verify-property", [Cl.uint(1)], address2);
      
      // Multiple token purchases (each generates platform fees)
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(100)], address2); // 2 STX fee
      simnet.callPublicFn(contractName, "purchase-tokens", [Cl.uint(1), Cl.uint(200)], address3); // 4 STX fee
      
      // Secondary market trading (also generates fees)
      simnet.callPublicFn(contractName, "list-tokens-for-sale", [Cl.uint(1), Cl.uint(50), Cl.uint(1200000)], address2);
      simnet.callPublicFn(contractName, "buy-listed-tokens", [Cl.uint(1), Cl.principal(address2), Cl.uint(50)], address3); // Additional fee
      
      // Owner withdraws accumulated fees
      const { result } = simnet.callPublicFn(contractName, "withdraw-platform-fees", [], deployer);
      expect(result).toBeOk(Cl.bool(true));
    });
  });