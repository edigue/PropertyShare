;; PropertyShare - Real Estate Fractional Ownership Platform

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-authorized (err u101))
(define-constant err-property-not-found (err u102))
(define-constant err-insufficient-tokens (err u103))
(define-constant err-insufficient-funds (err u104))
(define-constant err-invalid-parameter (err u105))
(define-constant err-property-not-active (err u106))
(define-constant err-already-verified (err u107))
(define-constant err-not-verified (err u108))

;; Data variables
(define-data-var total-properties uint u0)
(define-data-var platform-fee-percentage uint u200) ;; 2%
(define-data-var total-platform-fees uint u0)
(define-data-var contract-paused bool false)

;; Property data structure
(define-map properties
    uint
    {
        owner: principal,
        title: (string-utf8 128),
        location: (string-utf8 256),
        property-value: uint,
        total-tokens: uint,
        available-tokens: uint,
        monthly-rent: uint,
        verified: bool,
        active: bool,
        created-at: uint,
    }
)

;; Token ownership tracking
(define-map token-holdings
    {
        property-id: uint,
        holder: principal,
    }
    {
        tokens: uint,
        purchase-price: uint,
        acquired-at: uint,
    }
)

;; Property verification by authorized verifiers
(define-map authorized-verifiers
    principal
    bool
)

;; Property statistics
(define-map property-stats
    uint
    {
        total-holders: uint,
        total-distributed: uint,
        last-distribution: uint,
        appreciation-rate: uint,
    }
)

;; Read-only functions
(define-read-only (get-property-details (property-id uint))
    (map-get? properties property-id)
)

(define-read-only (get-token-holdings
        (property-id uint)
        (holder principal)
    )
    (map-get? token-holdings {
        property-id: property-id,
        holder: holder,
    })
)

(define-read-only (get-property-stats (property-id uint))
    (map-get? property-stats property-id)
)

(define-read-only (get-total-properties)
    (var-get total-properties)
)

(define-read-only (is-authorized-verifier (verifier principal))
    (default-to false (map-get? authorized-verifiers verifier))
)

(define-read-only (calculate-ownership-percentage
        (property-id uint)
        (holder principal)
    )
    (let (
            (property (unwrap! (map-get? properties property-id) (err u0)))
            (holding (unwrap!
                (map-get? token-holdings {
                    property-id: property-id,
                    holder: holder,
                })
                (err u0)
            ))
        )
        (ok (/ (* (get tokens holding) u10000) (get total-tokens property)))
    )
)

;; Private functions
(define-private (calculate-platform-fee (amount uint))
    (/ (* amount (var-get platform-fee-percentage)) u10000)
)

;; Property creation and management
(define-public (create-property
        (title (string-utf8 128))
        (location (string-utf8 256))
        (property-value uint)
        (total-tokens uint)
        (monthly-rent uint)
    )
    (let ((property-id (+ (var-get total-properties) u1)))
        (begin
            (asserts! (not (var-get contract-paused)) err-invalid-parameter)
            (asserts! (> property-value u0) err-invalid-parameter)
            (asserts! (> total-tokens u0) err-invalid-parameter)
            (asserts! (<= total-tokens u10000) err-invalid-parameter) ;; Max 10,000 tokens per property
            (map-set properties property-id {
                owner: tx-sender,
                title: title,
                location: location,
                property-value: property-value,
                total-tokens: total-tokens,
                available-tokens: total-tokens,
                monthly-rent: monthly-rent,
                verified: false,
                active: false,
                created-at: stacks-block-height,
            })
            (map-set property-stats property-id {
                total-holders: u0,
                total-distributed: u0,
                last-distribution: u0,
                appreciation-rate: u0,
            })
            (var-set total-properties property-id)
            (ok property-id)
        )
    )
)

(define-public (verify-property (property-id uint))
    (let ((property (unwrap! (map-get? properties property-id) err-property-not-found)))
        (begin
            (asserts! (is-authorized-verifier tx-sender) err-not-authorized)
            (asserts! (not (get verified property)) err-already-verified)
            (map-set properties property-id
                (merge property {
                    verified: true,
                    active: true,
                })
            )
            (ok true)
        )
    )
)

(define-public (add-authorized-verifier (verifier principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (map-set authorized-verifiers verifier true)
        (ok true)
    )
)

(define-public (remove-authorized-verifier (verifier principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (map-set authorized-verifiers verifier false)
        (ok true)
    )
)

;; Administrative functions
(define-public (set-platform-fee (new-fee uint))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (<= new-fee u1000) err-invalid-parameter) ;; Max 10%
        (var-set platform-fee-percentage new-fee)
        (ok true)
    )
)

(define-public (toggle-contract-pause)
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (var-set contract-paused (not (var-get contract-paused)))
        (ok true)
    )
)

(define-public (withdraw-platform-fees)
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (let ((fees (var-get total-platform-fees)))
            (var-set total-platform-fees u0)
            (stx-transfer? fees tx-sender contract-owner)
        )
    )
)

;; Token Purchase and Rental Income Distribution

;; Token purchase functionality
(define-public (purchase-tokens
        (property-id uint)
        (token-amount uint)
    )
    (let (
            (property (unwrap! (map-get? properties property-id) err-property-not-found))
            (token-price (/ (get property-value property) (get total-tokens property)))
            (total-cost (* token-amount token-price))
            (platform-fee (calculate-platform-fee total-cost))
            (net-cost (+ total-cost platform-fee))
            (current-holding (default-to {
                tokens: u0,
                purchase-price: u0,
                acquired-at: u0,
            }
                (map-get? token-holdings {
                    property-id: property-id,
                    holder: tx-sender,
                })
            ))
            (current-stats (unwrap! (map-get? property-stats property-id) err-property-not-found))
        )
        (begin
            (asserts! (not (var-get contract-paused)) err-invalid-parameter)
            (asserts! (get verified property) err-not-verified)
            (asserts! (get active property) err-property-not-active)
            (asserts! (> token-amount u0) err-invalid-parameter)
            (asserts! (<= token-amount (get available-tokens property))
                err-insufficient-tokens
            )
            (asserts! (>= (stx-get-balance tx-sender) net-cost)
                err-insufficient-funds
            )
            ;; Transfer payment to property owner
            (unwrap! (stx-transfer? total-cost tx-sender (get owner property))
                err-insufficient-funds
            )
            ;; Transfer platform fee
            (unwrap! (stx-transfer? platform-fee tx-sender contract-owner)
                err-insufficient-funds
            )
            ;; Update property available tokens
            (map-set properties property-id
                (merge property { available-tokens: (- (get available-tokens property) token-amount) })
            )
            ;; Update token holdings
            (map-set token-holdings {
                property-id: property-id,
                holder: tx-sender,
            } {
                tokens: (+ (get tokens current-holding) token-amount),
                purchase-price: (+ (get purchase-price current-holding) total-cost),
                acquired-at: stacks-block-height,
            })
            ;; Update property statistics
            (map-set property-stats property-id
                (merge current-stats { total-holders: (if (is-eq (get tokens current-holding) u0)
                    (+ (get total-holders current-stats) u1)
                    (get total-holders current-stats)
                ) }
                ))
            ;; Update platform fees
            (var-set total-platform-fees
                (+ (var-get total-platform-fees) platform-fee)
            )
            (ok true)
        )
    )
)

;; Rental income distribution
(define-map rental-distributions
    {
        property-id: uint,
        distribution-id: uint,
    }
    {
        total-amount: uint,
        per-token-amount: uint,
        distribution-date: uint,
        claimed-amount: uint,
    }
)

(define-map distribution-claims
    {
        property-id: uint,
        distribution-id: uint,
        holder: principal,
    }
    {
        amount: uint,
        claimed-at: uint,
    }
)

(define-data-var distribution-counter uint u0)

(define-public (distribute-rental-income
        (property-id uint)
        (total-amount uint)
    )
    (let (
            (property (unwrap! (map-get? properties property-id) err-property-not-found))
            (distribution-id (+ (var-get distribution-counter) u1))
            (per-token-amount (/ total-amount (get total-tokens property)))
            (current-stats (unwrap! (map-get? property-stats property-id) err-property-not-found))
        )
        (begin
            (asserts! (is-eq tx-sender (get owner property)) err-not-authorized)
            (asserts! (get verified property) err-not-verified)
            (asserts! (> total-amount u0) err-invalid-parameter)
            (asserts! (>= (stx-get-balance tx-sender) total-amount)
                err-insufficient-funds
            )
            ;; Create distribution record
            (map-set rental-distributions {
                property-id: property-id,
                distribution-id: distribution-id,
            } {
                total-amount: total-amount,
                per-token-amount: per-token-amount,
                distribution-date: stacks-block-height,
                claimed-amount: u0,
            })
            ;; Update property statistics
            (map-set property-stats property-id
                (merge current-stats {
                    total-distributed: (+ (get total-distributed current-stats) total-amount),
                    last-distribution: stacks-block-height,
                })
            )
            (var-set distribution-counter distribution-id)
            (ok distribution-id)
        )
    )
)

(define-public (claim-rental-income
        (property-id uint)
        (distribution-id uint)
    )
    (let (
            (property (unwrap! (map-get? properties property-id) err-property-not-found))
            (distribution (unwrap!
                (map-get? rental-distributions {
                    property-id: property-id,
                    distribution-id: distribution-id,
                })
                err-invalid-parameter
            ))
            (holding (unwrap!
                (map-get? token-holdings {
                    property-id: property-id,
                    holder: tx-sender,
                })
                err-insufficient-tokens
            ))
            (claim-amount (* (get tokens holding) (get per-token-amount distribution)))
            (existing-claim (map-get? distribution-claims {
                property-id: property-id,
                distribution-id: distribution-id,
                holder: tx-sender,
            }))
        )
        (begin
            (asserts! (is-none existing-claim) err-invalid-parameter)
            (asserts! (> claim-amount u0) err-insufficient-tokens)
            ;; Transfer rental income from property owner to token holder
            (unwrap! (stx-transfer? claim-amount (get owner property) tx-sender)
                err-insufficient-funds
            )
            ;; Record claim
            (map-set distribution-claims {
                property-id: property-id,
                distribution-id: distribution-id,
                holder: tx-sender,
            } {
                amount: claim-amount,
                claimed-at: stacks-block-height,
            })
            ;; Update distribution claimed amount
            (map-set rental-distributions {
                property-id: property-id,
                distribution-id: distribution-id,
            }
                (merge distribution { claimed-amount: (+ (get claimed-amount distribution) claim-amount) })
            )
            (ok claim-amount)
        )
    )
)

;; Read-only functions for distributions
(define-read-only (get-distribution-details
        (property-id uint)
        (distribution-id uint)
    )
    (map-get? rental-distributions {
        property-id: property-id,
        distribution-id: distribution-id,
    })
)

(define-read-only (get-claim-details
        (property-id uint)
        (distribution-id uint)
        (holder principal)
    )
    (map-get? distribution-claims {
        property-id: property-id,
        distribution-id: distribution-id,
        holder: holder,
    })
)

(define-read-only (calculate-claimable-income
        (property-id uint)
        (distribution-id uint)
        (holder principal)
    )
    (let (
            (distribution (unwrap!
                (map-get? rental-distributions {
                    property-id: property-id,
                    distribution-id: distribution-id,
                })
                (err u0)
            ))
            (holding (unwrap!
                (map-get? token-holdings {
                    property-id: property-id,
                    holder: holder,
                })
                (err u0)
            ))
            (existing-claim (map-get? distribution-claims {
                property-id: property-id,
                distribution-id: distribution-id,
                holder: holder,
            }))
        )
        (if (is-some existing-claim)
            (ok u0)
            (ok (* (get tokens holding) (get per-token-amount distribution)))
        )
    )
)

;; Secondary Market Trading System

;; Secondary market listings
(define-map token-listings
    {
        property-id: uint,
        seller: principal,
    }
    {
        tokens-for-sale: uint,
        price-per-token: uint,
        listed-at: uint,
        active: bool,
    }
)

;; Trading history
(define-map trade-history
    {
        property-id: uint,
        trade-id: uint,
    }
    {
        seller: principal,
        buyer: principal,
        tokens-traded: uint,
        price-per-token: uint,
        total-amount: uint,
        traded-at: uint,
    }
)

(define-data-var trade-counter uint u0)

;; Secondary market functions
(define-public (list-tokens-for-sale
        (property-id uint)
        (tokens-to-sell uint)
        (price-per-token uint)
    )
    (let (
            (property (unwrap! (map-get? properties property-id) err-property-not-found))
            (holding (unwrap!
                (map-get? token-holdings {
                    property-id: property-id,
                    holder: tx-sender,
                })
                err-insufficient-tokens
            ))
            (existing-listing (map-get? token-listings {
                property-id: property-id,
                seller: tx-sender,
            }))
        )
        (begin
            (asserts! (not (var-get contract-paused)) err-invalid-parameter)
            (asserts! (get verified property) err-not-verified)
            (asserts! (> tokens-to-sell u0) err-invalid-parameter)
            (asserts! (> price-per-token u0) err-invalid-parameter)
            (asserts! (<= tokens-to-sell (get tokens holding))
                err-insufficient-tokens
            )
            (asserts! (is-none existing-listing) err-invalid-parameter)
            (map-set token-listings {
                property-id: property-id,
                seller: tx-sender,
            } {
                tokens-for-sale: tokens-to-sell,
                price-per-token: price-per-token,
                listed-at: stacks-block-height,
                active: true,
            })
            (ok true)
        )
    )
)

(define-public (cancel-listing (property-id uint))
    (let ((listing (unwrap!
            (map-get? token-listings {
                property-id: property-id,
                seller: tx-sender,
            })
            err-invalid-parameter
        )))
        (begin
            (asserts! (get active listing) err-invalid-parameter)
            (map-set token-listings {
                property-id: property-id,
                seller: tx-sender,
            }
                (merge listing { active: false })
            )
            (ok true)
        )
    )
)

(define-public (buy-listed-tokens
        (property-id uint)
        (seller principal)
        (tokens-to-buy uint)
    )
    (let (
            (property (unwrap! (map-get? properties property-id) err-property-not-found))
            (listing (unwrap!
                (map-get? token-listings {
                    property-id: property-id,
                    seller: seller,
                })
                err-invalid-parameter
            ))
            (seller-holding (unwrap!
                (map-get? token-holdings {
                    property-id: property-id,
                    holder: seller,
                })
                err-insufficient-tokens
            ))
            (buyer-holding (default-to {
                tokens: u0,
                purchase-price: u0,
                acquired-at: u0,
            }
                (map-get? token-holdings {
                    property-id: property-id,
                    holder: tx-sender,
                })
            ))
            (total-cost (* tokens-to-buy (get price-per-token listing)))
            (platform-fee (calculate-platform-fee total-cost))
            (seller-amount (- total-cost platform-fee))
            (trade-id (+ (var-get trade-counter) u1))
        )
        (begin
            (asserts! (not (var-get contract-paused)) err-invalid-parameter)
            (asserts! (get active listing) err-invalid-parameter)
            (asserts! (> tokens-to-buy u0) err-invalid-parameter)
            (asserts! (<= tokens-to-buy (get tokens-for-sale listing))
                err-insufficient-tokens
            )
            (asserts! (>= (stx-get-balance tx-sender) total-cost)
                err-insufficient-funds
            )
            (asserts! (not (is-eq tx-sender seller)) err-invalid-parameter)
            ;; Transfer payment to seller
            (unwrap! (stx-transfer? seller-amount tx-sender seller)
                err-insufficient-funds
            )
            ;; Transfer platform fee
            (unwrap! (stx-transfer? platform-fee tx-sender contract-owner)
                err-insufficient-funds
            )
            ;; Update seller's token holdings
            (map-set token-holdings {
                property-id: property-id,
                holder: seller,
            }
                (merge seller-holding { tokens: (- (get tokens seller-holding) tokens-to-buy) })
            )
            ;; Update buyer's token holdings
            (map-set token-holdings {
                property-id: property-id,
                holder: tx-sender,
            } {
                tokens: (+ (get tokens buyer-holding) tokens-to-buy),
                purchase-price: (+ (get purchase-price buyer-holding) total-cost),
                acquired-at: stacks-block-height,
            })
            ;; Update listing
            (if (is-eq tokens-to-buy (get tokens-for-sale listing))
                ;; Complete sale - deactivate listing
                (map-set token-listings {
                    property-id: property-id,
                    seller: seller,
                }
                    (merge listing {
                        active: false,
                        tokens-for-sale: u0,
                    })
                )
                ;; Partial sale - reduce available tokens
                (map-set token-listings {
                    property-id: property-id,
                    seller: seller,
                }
                    (merge listing { tokens-for-sale: (- (get tokens-for-sale listing) tokens-to-buy) })
                )
            )
            ;; Record trade history
            (map-set trade-history {
                property-id: property-id,
                trade-id: trade-id,
            } {
                seller: seller,
                buyer: tx-sender,
                tokens-traded: tokens-to-buy,
                price-per-token: (get price-per-token listing),
                total-amount: total-cost,
                traded-at: stacks-block-height,
            })
            ;; Update property statistics if new holder
            (let ((current-stats (unwrap! (map-get? property-stats property-id)
                    err-property-not-found
                )))
                (if (is-eq (get tokens buyer-holding) u0)
                    (map-set property-stats property-id
                        (merge current-stats { total-holders: (+ (get total-holders current-stats) u1) })
                    )
                    true
                )
            )
            ;; Update platform fees and trade counter
            (var-set total-platform-fees
                (+ (var-get total-platform-fees) platform-fee)
            )
            (var-set trade-counter trade-id)
            (ok trade-id)
        )
    )
)

(define-public (update-property-value
        (property-id uint)
        (new-value uint)
    )
    (let ((property (unwrap! (map-get? properties property-id) err-property-not-found)))
        (begin
            (asserts! (is-authorized-verifier tx-sender) err-not-authorized)
            (asserts! (> new-value u0) err-invalid-parameter)
            ;; Calculate appreciation rate
            (let (
                    (old-value (get property-value property))
                    (appreciation-rate (if (> new-value old-value)
                        (/ (* (- new-value old-value) u10000) old-value)
                        u0
                    ))
                    (current-stats (unwrap! (map-get? property-stats property-id)
                        err-property-not-found
                    ))
                )
                ;; Update property value
                (map-set properties property-id
                    (merge property { property-value: new-value })
                )
                ;; Update appreciation rate in stats
                (map-set property-stats property-id
                    (merge current-stats { appreciation-rate: appreciation-rate })
                )
            )
            (ok true)
        )
    )
)

;; Read-only functions for secondary market
(define-read-only (get-token-listing
        (property-id uint)
        (seller principal)
    )
    (map-get? token-listings {
        property-id: property-id,
        seller: seller,
    })
)

(define-read-only (get-trade-history
        (property-id uint)
        (trade-id uint)
    )
    (map-get? trade-history {
        property-id: property-id,
        trade-id: trade-id,
    })
)

(define-read-only (calculate-portfolio-value (holder principal))
    (ok u0)
    ;; Simplified - would iterate through all holdings in practice
)

;; Emergency functions
(define-public (emergency-delist
        (property-id uint)
        (seller principal)
    )
    (let ((listing (unwrap!
            (map-get? token-listings {
                property-id: property-id,
                seller: seller,
            })
            err-invalid-parameter
        )))
        (begin
            (asserts! (is-eq tx-sender contract-owner) err-owner-only)
            (map-set token-listings {
                property-id: property-id,
                seller: seller,
            }
                (merge listing { active: false })
            )
            (ok true)
        )
    )
)
