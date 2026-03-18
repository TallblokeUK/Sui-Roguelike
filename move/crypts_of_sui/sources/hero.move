/// Hero module — mint heroes at game start, burn them on death.
/// The on-chain Hero is proof of existence; stats live client-side.
/// Death emits a permanent event with the hero's final stats.
module crypts_of_sui::hero;

use std::string::String;
use sui::event;

// ─── Objects ───

/// A living hero in the Crypts of Sui.
public struct Hero has key, store {
    id: UID,
    name: String,
}

// ─── Events ───

/// Emitted when a hero is minted.
public struct HeroMint has copy, drop {
    hero_id: address,
    name: String,
    owner: address,
}

/// Emitted when a hero dies — permanent on-chain death record.
public struct HeroDeath has copy, drop {
    hero_id: address,
    name: String,
    level: u64,
    floor: u64,
    kills: u64,
    turns: u64,
    cause_of_death: String,
    owner: address,
}

// ─── Entry functions ───

/// Mint a new hero and transfer to the specified recipient.
/// The sponsor calls this but the hero is owned by the player.
public entry fun mint_hero(
    name: String,
    recipient: address,
    ctx: &mut TxContext,
) {
    let hero = Hero {
        id: object::new(ctx),
        name,
    };
    let hero_id = object::uid_to_address(&hero.id);

    event::emit(HeroMint {
        hero_id,
        name: hero.name,
        owner: recipient,
    });

    transfer::public_transfer(hero, recipient);
}

/// Burn a hero on death. Consumes the object and emits a death event.
/// Must be called by the hero's owner (the player via zkLogin).
public entry fun burn_hero(
    hero: Hero,
    level: u64,
    floor: u64,
    kills: u64,
    turns: u64,
    cause_of_death: String,
    ctx: &mut TxContext,
) {
    let Hero { id, name } = hero;
    let hero_id = object::uid_to_address(&id);
    let owner = ctx.sender();

    event::emit(HeroDeath {
        hero_id,
        name,
        level,
        floor,
        kills,
        turns,
        cause_of_death,
        owner,
    });

    object::delete(id);
}

/// Record a hero's death on-chain without requiring the hero object.
/// Called server-side by the sponsor for reliable event emission.
/// The hero object remains (best-effort burn happens separately via zkLogin).
public entry fun record_death(
    hero_name: String,
    level: u64,
    floor: u64,
    kills: u64,
    turns: u64,
    cause_of_death: String,
    player: address,
) {
    event::emit(HeroDeath {
        hero_id: @0x0,
        name: hero_name,
        level,
        floor,
        kills,
        turns,
        cause_of_death,
        owner: player,
    });
}
