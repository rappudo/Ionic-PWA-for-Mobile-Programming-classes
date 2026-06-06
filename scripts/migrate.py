"""
One-shot migration of To_entediado_completo2.json into src/assets/animes.json.

Filters to the 33 "logical" animes (everything filled except Berserk,
which uses 'recomenda_manga' and is dropped for now). Dedupes Toaru Kagaku
no Accelerator. Normalizes schema to camelCase PT.
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "To_entediado_completo2.json"
DST = ROOT / "src" / "assets" / "animes.json"

RECOMENDACAO_MAP = {
    "VEJA IMEDIATAMENTE": "veja_imediatamente",
    "Veja": "veja",
    "Média prioridade": "media_prioridade",
    "Baixa prioridade": "baixa_prioridade",
}

DROP_RECOMENDACAO = {"VEJA IMEDIATAMENTE ( o mangá)"}


def slugify(s: str) -> str:
    s = s.lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def parse_date(s: str) -> str:
    d, m, y = s.split("/")
    return f"{y}-{m}-{d}"


def parse_temporadas(t) -> tuple[int, int]:
    if isinstance(t, int):
        return t, 0
    s = t.strip()
    if re.fullmatch(r"\d+", s):
        return int(s), 0
    # "N + M filme(s)"
    m = re.fullmatch(r"(\d+)\s*\+\s*(\d+)\s*filmes?", s)
    if m:
        return int(m.group(1)), int(m.group(2))
    # "N + filme(s)"  (ambíguo, assume 1 filme)
    m = re.fullmatch(r"(\d+)\s*\+\s*filmes?", s)
    if m:
        return int(m.group(1)), 1
    # "N filme(s)" — só filme(s), sem TV
    m = re.fullmatch(r"(\d+)\s*filmes?", s)
    if m:
        return 0, int(m.group(1))
    raise ValueError(f"Temporadas não reconhecido: {t!r}")


def parse_onde_ver(s) -> list[str]:
    if s is None:
        return []
    parts = re.split(r"[,/]", s)
    return [p.strip() for p in parts if p.strip()]


def parse_classificacao(s: str) -> str | None:
    if not s:
        return None
    if s == "Livre":
        return "L"
    return s


def normalize_generos(gs: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for g in gs:
        g = g.strip().lower()
        if g and g not in seen:
            seen.add(g)
            out.append(g)
    return out


def is_filled(v) -> bool:
    return v not in ("", None, [])


def is_keepable(a: dict) -> bool:
    rec = a["Recomendacao"].strip()
    if rec in DROP_RECOMENDACAO:
        return False
    return (
        is_filled(rec)
        and is_filled(a["Clas_indicativa:"])
        and is_filled(a["Onde_ver"])
    )


def migrate(a: dict) -> dict:
    rec_raw = a["Recomendacao"].strip()
    rec = RECOMENDACAO_MAP[rec_raw]
    temporadas, filmes = parse_temporadas(a["Temporadas"])
    return {
        "id": slugify(a["Nome"][0]),
        "nome": a["Nome"],
        "sinopse": a["Sinopse"].strip(),
        "generos": normalize_generos(a["Generos"]),
        "estudio": a["Estudio"],
        "ondeVer": parse_onde_ver(a["Onde_ver"]),
        "temporadas": temporadas,
        "filmes": filmes,
        "episodios": a["Episodios"],
        "porcentagemDublado": a["Porcentagem_dublado"],
        "dataLancamento": parse_date(a["Data_de_lancamento"]),
        "classificacaoIndicativa": parse_classificacao(a["Clas_indicativa:"]),
        "recomendacao": rec,
        "ordem": None,
        "imagem": None,
    }


def main() -> None:
    raw = json.loads(SRC.read_text(encoding="utf-8"))
    kept = [migrate(a) for a in raw["animes"] if is_keepable(a)]

    seen_ids: set[str] = set()
    deduped: list[dict] = []
    for a in kept:
        if a["id"] in seen_ids:
            print(f"  dedup: removendo duplicata {a['id']}")
            continue
        seen_ids.add(a["id"])
        deduped.append(a)

    deduped.sort(key=lambda x: x["nome"][0].lower())
    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_text(
        json.dumps(deduped, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Escritos {len(deduped)} animes em {DST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
