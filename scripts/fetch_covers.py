"""
Populates the `imagem` field of src/assets/animes.json by querying the
Jikan v4 API for each anime, preferring `images.jpg.large_image_url`.

By default, skips entries that already have an `imagem`. Use --force to
refresh URLs for every entry, or --only id1,id2 to target specific ones.

A few internal ids are pinned to a MAL anime id (see MAL_ID_OVERRIDES)
because their title search resolves to the wrong MAL entry.

Rate limit (Jikan public): 3 req/s AND 60 req/min — the per-minute cap
is the binding constraint, so we sleep ~1.1s between calls.
"""
import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "assets" / "animes.json"
JIKAN_BASE = "https://api.jikan.moe/v4"
DELAY_S = 1.1
USER_AGENT = "projeto-animes/0.1 (educational)"

# Entries whose title search would resolve to a wrong/ambiguous anime.
# Map our internal id -> MAL anime id.
MAL_ID_OVERRIDES: dict[str, int] = {
    "black-cat": 530,  # Black Cat (2005, Gonzo)
}


def _request(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp)


def _largest_image(images: dict) -> str | None:
    jpg = images.get("jpg") or {}
    return jpg.get("large_image_url") or jpg.get("image_url")


def fetch_by_id(mal_id: int) -> str | None:
    data = _request(f"{JIKAN_BASE}/anime/{mal_id}").get("data") or {}
    return _largest_image(data.get("images") or {})


def fetch_by_search(query: str) -> str | None:
    url = f"{JIKAN_BASE}/anime?q={urllib.parse.quote(query)}&limit=1"
    hits = _request(url).get("data") or []
    if not hits:
        return None
    return _largest_image(hits[0].get("images") or {})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Refresh image URLs even for entries that already have one.",
    )
    parser.add_argument(
        "--only",
        help="Comma-separated list of anime ids to process (skips all others).",
    )
    args = parser.parse_args()

    only = {s.strip() for s in args.only.split(",")} if args.only else None

    animes = json.loads(DATA.read_text(encoding="utf-8"))
    updated = 0
    for a in animes:
        anime_id = a["id"]
        if only is not None and anime_id not in only:
            continue
        if a.get("imagem") and not args.force and only is None:
            continue

        try:
            if anime_id in MAL_ID_OVERRIDES:
                url = fetch_by_id(MAL_ID_OVERRIDES[anime_id])
            else:
                url = fetch_by_search(a["nome"][0])
        except urllib.error.HTTPError as e:
            wait = float(e.headers.get("Retry-After") or DELAY_S * 4)
            print(f"  http {e.code} ao buscar {anime_id}, aguardando {wait:.1f}s")
            time.sleep(wait)
            continue
        except Exception as e:
            print(f"  erro ao buscar {anime_id}: {e}")
            time.sleep(DELAY_S)
            continue

        if url:
            if a.get("imagem") != url:
                a["imagem"] = url
                updated += 1
                print(f"  ok: {anime_id} -> {url}")
            else:
                print(f"  ja atualizado: {anime_id}")
        else:
            print(f"  sem resultado: {anime_id}")
        time.sleep(DELAY_S)

    if updated:
        DATA.write_text(
            json.dumps(animes, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"Atualizados {updated} animes.")


if __name__ == "__main__":
    main()
