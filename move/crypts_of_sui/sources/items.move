/// Items module — mint loot as real Sui objects.
/// Each item found in the dungeon becomes an owned object in the player's wallet.
module crypts_of_sui::items;

use std::string::String;
use sui::event;

// ─── Objects ───

/// A dungeon item — weapon, armor, potion, or ring.
public struct Item has key, store {
    id: UID,
    name: String,
    /// 0 = weapon, 1 = armor, 2 = potion, 3 = ring
    item_type: u8,
    /// 0 = common, 1 = rare, 2 = epic, 3 = legendary
    rarity: u8,
    value: u64,
    glyph: String,
    description: String,
}

// ─── Events ───

/// Emitted when an item is minted (picked up in the dungeon).
public struct ItemMint has copy, drop {
    item_id: address,
    name: String,
    item_type: u8,
    rarity: u8,
    hero_name: String,
    floor: u64,
    owner: address,
}

// ─── Entry functions ───

/// Mint an item and transfer to the specified recipient.
/// The sponsor calls this but the item is owned by the player.
public entry fun mint_item(
    name: String,
    item_type: u8,
    rarity: u8,
    value: u64,
    glyph: String,
    description: String,
    hero_name: String,
    floor: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    let item = Item {
        id: object::new(ctx),
        name,
        item_type,
        rarity,
        value,
        glyph,
        description,
    };
    let item_id = object::uid_to_address(&item.id);

    event::emit(ItemMint {
        item_id,
        name: item.name,
        item_type,
        rarity,
        hero_name,
        floor,
        owner: recipient,
    });

    transfer::public_transfer(item, recipient);
}
