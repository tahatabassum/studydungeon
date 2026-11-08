from app.services.combat import calculate_combat_damage, calculate_next_review_interval


def test_combat_damage_calculation():
    # Normal hit with Rusty Dagger
    damage, player_dmg, is_crit = calculate_combat_damage(
        weapon_name="Rusty Dagger",
        difficulty="medium",
        current_streak=0,
        is_correct=True,
    )
    assert damage == 20
    assert player_dmg == 0
    assert not is_crit

    # Hard difficulty multiplier
    damage, player_dmg, is_crit = calculate_combat_damage(
        weapon_name="Rusty Dagger",
        difficulty="hard",
        current_streak=0,
        is_correct=True,
    )
    assert damage == 25  # 20 * 1.25

    # 3-in-a-row critical hit
    damage, player_dmg, is_crit = calculate_combat_damage(
        weapon_name="Rusty Dagger",
        difficulty="medium",
        current_streak=2,
        is_correct=True,
    )
    assert damage == 30  # 20 * 1.5
    assert is_crit is True

    # Monster counter-attack on wrong answer
    damage, player_dmg, is_crit = calculate_combat_damage(
        weapon_name="Rusty Dagger",
        difficulty="medium",
        current_streak=5,
        is_correct=False,
    )
    assert damage == 0
    assert player_dmg == 10  # 10 HP lost

    # Boss counter-attack on wrong answer
    damage, player_dmg, is_crit = calculate_combat_damage(
        weapon_name="Rusty Dagger",
        difficulty="medium",
        current_streak=5,
        is_correct=False,
        is_boss=True,
    )
    assert damage == 0
    assert player_dmg == 12  # 12 HP lost


def test_srs_intervals():
    # Incorrect resets to ~10 minutes
    rep, interval, due = calculate_next_review_interval(current_repetition=4, is_correct=False)
    assert rep == 0
    assert interval < 1.0

    # First correct gives 3 days
    rep, interval, due = calculate_next_review_interval(current_repetition=0, is_correct=True)
    assert rep == 1
    assert interval == 3.0

    # Second correct gives 7 days
    rep, interval, due = calculate_next_review_interval(current_repetition=1, is_correct=True)
    assert rep == 2
    assert interval == 7.0

