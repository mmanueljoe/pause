//! Pause: a vault where every withdrawal waits, so the owner or a trusted
//! guardian can stop it.
//!
//! The rules live here, in the program, never only in the website.
//! See `docs/requirements.md` ("Core rules" and "Solana program actions").
//! Actions are added one user story at a time, each with tests for who is
//! refused and when.

use anchor_lang::prelude::*;

#[cfg(test)]
mod tests;

declare_id!("BUFdujWydbi7UA13x1EnBavq7iwNjaxip5Csuv9fjEDz");

#[program]
pub mod pause {}
