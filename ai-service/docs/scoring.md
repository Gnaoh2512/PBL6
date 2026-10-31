# Explainable room scoring (experimental)

Version `multi-criteria-experimental-v1` is an **experimental configuration**. Its weights
are illustrative and have not been shown to optimize bookings, satisfaction, or any other
outcome. The previous `amenity-baseline-v1` scorer remains injectable for a controlled
comparison. It computes `matched preferred amenity codes / requested preferred amenity
codes`, or zero when none are requested.

## Eligibility before scoring

The live availability response remains the only source of rooms. The pipeline first
deduplicates and validates candidates, then applies status, dates, nights, capacity
`>= guestCount`, optional room type, inclusive per-night `minPrice`/`maxPrice`, and all
verified required amenities. Optional `totalBudget` also filters inclusively against the
backend's `totalRoomCharge`. These are hard constraints and contribute no points. All
money stays `Decimal`; an amount equal to a price boundary passes the filter. Backend
pricing, stay total and deposit are copied without recalculation.

## Experimental formula

The request may carry `preferences.amenities`, `preferences.price` (`SAVE` or `PREMIUM`),
and `preferences.capacity` (`CLOSE_FIT` or `SPACIOUS`). The price and capacity choices
must be explicitly expressed. A maximum budget is a filter, never an inferred `SAVE`
preference. `guestCount` is a minimum capacity, never an inferred `CLOSE_FIT` choice.
`capacity` means maximum guest count, not area, room width or bed count. The legacy
wire value `SPACIOUS` is retained for contract compatibility and means only “prefer
higher guest capacity.” It cannot prove a room is physically more spacious. A request
for “phòng rộng” is held for clarification; an explicit desire for spare capacity
activates this score. A specified preferred count such as four for two actual guests
is represented only as a directional preference by the current schema, not as a
guaranteed four-person threshold. Backend room descriptions may mention size but
there is no structured area field in the availability DTO, so descriptions never
become a derived area score.

| Component | Score in `[0, 1]` when requested | Default weight |
|---|---|---:|
| Amenities | Verified preferred codes / distinct requested preferred codes | 0.40 |
| Price | `(highest eligible price - room price) / range` for `SAVE`; `(room price - lowest eligible price) / range` for `PREMIUM` | 0.35 |
| Capacity | `(highest eligible capacity - room capacity) / range` for `CLOSE_FIT`; `(room capacity - lowest eligible capacity) / range` for `SPACIOUS` | 0.25 |

The ranges use only **eligible** rooms. If all eligible rooms have the same value, every
room receives `1` for that requested component; the component cannot distinguish them.
If a component was not requested, its score is `null`, it contributes no points, and
its weight is excluded from the denominator. Missing, negative, or unrecognized
amenity evidence scores zero for that requested amenity and cannot create a reason.
Price and capacity are required backend candidate fields; a malformed candidate is an
integration error rather than an invented score. A component with configured weight
zero has no ranking effect, even when requested.

```text
overall = sum(active component score * configured weight) / sum(active configured weights)
```

If there are no active positive weights, overall is zero. Weights are nonnegative finite
Decimals with at least one positive value in the configuration. Environment variables
`SCORING_AMENITY_WEIGHT`, `SCORING_PRICE_WEIGHT`, and `SCORING_CAPACITY_WEIGHT` override
the defaults. Invalid configuration fails validation at startup. The version is fixed
for this formula; changing the formula or defaults requires a new version.

## Ranking and evidence

Order is **overall score descending**, then `sortBy` as a per-night price tie-breaker:
`PRICE_DESC` means descending, `PRICE_ASC` or omitted means ascending. Remaining ties use
integer `roomId` ascending. Backend return order has no effect. `topK` truncates only
after filtering, scoring and sorting. `sortBy` by itself does not activate the price
component, and an explicit price preference does not change the tie-breaker.

The response exposes `scoringVersion`, per-room `scoreBreakdown`,
`matchedPreferences`, `unmatchedPreferences`, and Vietnamese `reasons`. The breakdown
contains `amenities`, `price`, and `capacity`, each with `score`, `weight`, and optional
`evidence`. The preference arrays contain `criterion`, `requested`, and `evidence`.
An amenity is matched only with verified `PRESENT` evidence. Price and capacity are
matched when the room scores `1` on that requested component; other requested values
are unmatched, even though they can contribute partial points. Numeric evidence is
the backend per-night price or capacity, without an invented currency. Reasons cite
only verified required amenities, matched amenity preferences, and requested price/capacity
scores with their backend values, generated deterministically
from backend evidence and score breakdown. There is no second LLM call.
The Vietnamese capacity reason says “sức chứa lớn hơn” for `SPACIOUS`; it never
calls the room wider or quotes an unverified area.

Relative normalization describes which eligible room best fits an expressed direction;
it is not a calibrated probability or quality rating. These experimental weights
have not been evaluated against the baseline on production outcomes.
