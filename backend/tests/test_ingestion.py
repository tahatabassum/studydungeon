from app.services.ingestion import check_text_quality, clean_and_normalize_text


def test_text_normalization():
    dirty_text = "Topic 1:   CPU \r\n\r\n\r\n\r\nPerforms   arithmetic."
    cleaned = clean_and_normalize_text(dirty_text)
    assert "\r" not in cleaned
    assert "Topic 1: CPU" in cleaned


def test_text_quality_checks():
    short_text = "Too short"
    res = check_text_quality(short_text, min_chars=100)
    assert res.is_valid is False

    valid_text = (
        "This lecture note covers CPU architecture, registers, Arithmetic Logic Units, and bus interconnects. " * 5
    )
    res = check_text_quality(valid_text, min_chars=100)
    assert res.is_valid is True
    assert res.readable_ratio >= 0.90

