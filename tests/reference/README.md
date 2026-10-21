# Original TypeScript engine

language/ is an unchanged copy of the published engine before the Rust migration. It preserves the original implementation and provides an independent compatibility oracle.

Only migration tests import it. Application code and production workers use engine/src compiled to WebAssembly, with no TypeScript execution fallback. Do not change this reference to make a failing comparison pass. Explain intended language changes separately.

The reference remains ordinary source in repository language statistics. No Linguist overrides hide it or alter the language mix.
