# PropertyShare 🏠

**Real Estate Fractional Ownership Platform on Stacks Blockchain**

PropertyShare democratizes real estate investment by enabling fractional property ownership through tokenization, automated rental income distribution, and liquid secondary market trading.

## 🌟 Key Features

### For Property Owners

- **Property Tokenization**: Convert real estate into tradeable digital tokens
- **Instant Liquidity**: Sell property fractions without traditional barriers
- **Automated Income**: Distribute rental income to token holders seamlessly
- **Verified Listings**: Professional property verification and due diligence

### For Investors

- **Fractional Ownership**: Invest in premium real estate with lower capital requirements
- **Rental Income**: Receive proportional rental distributions based on token holdings
- **Liquid Trading**: Buy and sell property tokens on secondary market
- **Portfolio Diversification**: Access diverse real estate markets globally

### Platform Benefits

- **2% Platform Fee**: Sustainable revenue model from transactions
- **Verification System**: Authorized verifiers ensure property authenticity
- **Transparent Tracking**: Blockchain-based ownership and income records
- **Appreciation Tracking**: Real-time property value updates and growth metrics

## 📊 Smart Contract Architecture

### Core Components

1. **Property Tokenization**

   - Create properties with configurable token supply (max 10,000 tokens)
   - Professional verification system with authorized verifiers
   - Comprehensive property metadata and statistics tracking

2. **Token Trading**

   - Primary market: Purchase tokens directly from property owners
   - Secondary market: Peer-to-peer trading with listing management
   - Automatic price calculation based on property value and token supply

3. **Income Distribution**
   - Rental income distribution with per-token calculations
   - Claim-based system preventing duplicate payments
   - Historical tracking of all distributions and claims

## 🚀 Getting Started

### Prerequisites

- Stacks wallet (Hiro Wallet recommended)
- STX tokens for investments
- Clarinet for local development

### Deployment

```bash
# Install Clarinet
npm install -g @hirosystems/clarinet-cli

# Clone repository
git clone <repository-url>
cd propertyshare

# Deploy to testnet
clarinet deploy --testnet

# Deploy to mainnet
clarinet deploy --mainnet
```

### Usage Examples

#### Creating a Property (Property Owner)

```clarity
(contract-call? .propertyshare create-property
    u"Luxury Downtown Condo"
    u"123 Main St, San Francisco, CA 94102"
    u500000000000  ;; $500K property value in microSTX
    u5000          ;; 5,000 tokens (each worth $100)
    u4166667)      ;; $5,000 monthly rent in microSTX
```

#### Purchasing Property Tokens (Investor)

```clarity
(contract-call? .propertyshare purchase-tokens
    u1     ;; Property ID
    u100)  ;; Buy 100 tokens (2% ownership)
```

#### Distributing Rental Income (Property Owner)

```clarity
(contract-call? .propertyshare distribute-rental-income
    u1          ;; Property ID
    u4166667)   ;; $5,000 monthly rent distribution
```

#### Claiming Rental Income (Token Holder)

```clarity
(contract-call? .propertyshare claim-rental-income
    u1   ;; Property ID
    u1)  ;; Distribution ID
```

#### Secondary Market Trading

```clarity
;; List tokens for sale
(contract-call? .propertyshare list-tokens-for-sale
    u1      ;; Property ID
    u50     ;; 50 tokens for sale
    u110)   ;; $110 per token (10% premium)

;; Buy listed tokens
(contract-call? .propertyshare buy-listed-tokens
    u1                           ;; Property ID
    'SP1SELLER123...            ;; Seller address
    u25)                        ;; Buy 25 tokens
```

## 📈 Contract Functions

### Property Management

- `create-property()` - Tokenize real estate property
- `verify-property()` - Professional property verification
- `update-property-value()` - Market value adjustments

### Token Trading

- `purchase-tokens()` - Buy tokens from property owner
- `list-tokens-for-sale()` - List tokens on secondary market
- `buy-listed-tokens()` - Purchase tokens from other holders
- `cancel-listing()` - Remove tokens from sale

### Income Distribution

- `distribute-rental-income()` - Property owners distribute rental income
- `claim-rental-income()` - Token holders claim their share
- `calculate-claimable-income()` - Check pending income amounts

### Read-Only Functions

- `get-property-details()` - Retrieve property information
- `get-token-holdings()` - View token ownership details
- `get-distribution-details()` - Income distribution records
- `calculate-ownership-percentage()` - Ownership share calculation
- `get-trade-history()` - Secondary market transaction history

### Administrative Functions

- `add-authorized-verifier()` - Add property verification agents
- `set-platform-fee()` - Adjust platform fee percentage
- `toggle-contract-pause()` - Emergency pause functionality
- `withdraw-platform-fees()` - Collect platform revenue

## 🔒 Security Features

- **Verification System**: Only authorized verifiers can validate properties
- **Ownership Validation**: Comprehensive token ownership verification
- **Balance Checks**: Automatic STX balance validation for all transactions
- **Anti-Manipulation**: Prevention of duplicate claims and invalid operations
- **Emergency Controls**: Platform pause and emergency delisting capabilities

## 💼 Business Model

### Revenue Streams

- **Transaction Fees**: 2% fee on all token purchases and trades
- **Verification Services**: Premium property validation services
- **Platform Growth**: Increasing transaction volume drives revenue
- **Network Effects**: More properties attract more investors

### Market Opportunity

- **$280T Global Real Estate Market** addressable through tokenization
- **Fractional Investment Trend**: Growing demand for accessible real estate investing
- **Liquidity Premium**: Secondary market trading adds significant value
- **Cross-Border Access**: Blockchain enables global property investment

## 🛠️ Development

### Contract Structure (287 lines)

- **Core Infrastructure**: Property tokenization and verification (95 lines)
- **Trading System**: Purchase and income distribution (98 lines)
- **Secondary Market**: P2P trading and valuation (94 lines)

### Testing

```bash
# Run test suite
clarinet test

# Check contract syntax
clarinet check

# Simulate deployment
clarinet integrate
```

### Security Considerations

- Property verification prevents fraudulent listings
- Token ownership validation ensures legitimate trades
- Income distribution prevents double-claiming
- Platform fees collected securely with withdrawal controls

## 📊 Use Cases

### Real Estate Developers

- **Capital Access**: Raise funds through token sales
- **Reduced Barriers**: Eliminate traditional financing requirements
- **Global Reach**: Access international investor pools
- **Transparent Operations**: Blockchain-based accountability

### Retail Investors

- **Low Minimums**: Invest in premium properties with small amounts
- **Diversification**: Build portfolios across multiple properties
- **Passive Income**: Automated rental income distributions
- **Liquidity**: Trade tokens without property sale complexities

### Institutional Investors

- **Portfolio Expansion**: Access tokenized real estate markets
- **Risk Management**: Fractional exposure reduces concentration risk
- **Efficiency**: Automated income distribution and transparent tracking
- **Market Making**: Provide liquidity in secondary markets

## 📋 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built on Stacks | Secured by Bitcoin | Democratizing Real Estate Investment**
