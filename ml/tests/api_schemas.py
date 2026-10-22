"""JSON Schemas of the label server answers. They mirror `tools/label-app/src/api/types.ts`: a
change of one needs the same change in the other (ADR-034)."""

NUMBER = {"type": "number"}
INTEGER = {"type": "integer"}
STRING = {"type": "string"}
BOOLEAN = {"type": "boolean"}
NULLABLE_STRING = {"type": ["string", "null"]}
SOURCE = {"enum": ["app", "photo"]}
CELL_SOURCE = {"enum": ["app", "photo", "loose"]}
CORNERS = {
    "type": ["array", "null"],
    "items": {"type": "array", "items": NUMBER, "minItems": 2, "maxItems": 2},
    "minItems": 4,
    "maxItems": 4,
}


def strict(properties: dict, optional: tuple[str, ...] = ()) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": [k for k in properties if k not in optional],
        "additionalProperties": False,
    }


START = strict(
    {
        "outlines": INTEGER,
        "digit_cells": INTEGER,
        "kind_cells": INTEGER,
        "not_prelabelled": INTEGER,
        "model": NULLABLE_STRING,
        "doubtful": {"type": ["integer", "null"]},
        "suspects": BOOLEAN,
        "changes": INTEGER,
    }
)

OUTLINES = strict(
    {
        "scans": {
            "type": "array",
            "items": strict({"photo": STRING, "source": SOURCE, "fit": NUMBER, "corners": CORNERS}),
        },
        "open": INTEGER,
        "page": INTEGER,
        "pages": INTEGER,
    }
)

OUTLINE = strict(
    {
        "photo": STRING,
        "source": SOURCE,
        "status": {"enum": ["unchecked", "accepted", "rejected"]},
        "width": INTEGER,
        "height": INTEGER,
        "corners": CORNERS,
    }
)


def probabilities(size: int) -> dict:
    return {"type": "array", "items": NUMBER, "minItems": size, "maxItems": size}


def signal(name: str, **fields: dict) -> dict:
    return strict({"signal": {"const": name}, **fields})


REASON = {
    "oneOf": [
        signal("low-p", p=NUMBER),
        signal("model-differs", predicted=STRING, p=NUMBER),
        signal("edited"),
        signal("rule-break", unit={"enum": ["row", "col", "box"]}, index=INTEGER),
        signal("not-unique"),
        signal("no-guess"),
    ]
}

CHECK_CELL = strict(
    {
        "id": STRING,
        "stem": STRING,
        "photo": NULLABLE_STRING,
        "source": CELL_SOURCE,
        "row": {"type": ["integer", "null"]},
        "col": {"type": ["integer", "null"]},
        "digit": NULLABLE_STRING,
        "kind": NULLABLE_STRING,
        "edited": BOOLEAN,
        "probs": {
            "oneOf": [
                {"type": "null"},
                strict({"digit": probabilities(10), "kind": probabilities(4)}),
            ]
        },
        "doubt": NUMBER,
        "reasons": {"type": "array", "items": REASON},
    }
)

CHECK = strict(
    {
        "digit": STRING,
        "cells": {"type": "array", "items": CHECK_CELL},
        "left": INTEGER,
        "counts": {"type": "object", "additionalProperties": INTEGER},
        "done": {"type": "object", "additionalProperties": INTEGER},
        "sure": INTEGER,
        "threshold": NUMBER,
    }
)

CHECK_KINDS = strict(
    {
        **CHECK["properties"],
        "kind_counts": strict(
            {"all": INTEGER, "printed": INTEGER, "handwritten": INTEGER, "unsure": INTEGER}
        ),
    }
)

SURE = strict({"cells": INTEGER})

DOUBTFUL = strict(
    {
        "items": {
            "type": "array",
            "items": strict(
                {
                    "id": STRING,
                    "stem": STRING,
                    "field": {"enum": ["digit", "kind"]},
                    "folder": STRING,
                    "kind": NULLABLE_STRING,
                    "reasons": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"reason": STRING},
                            "required": ["reason"],
                        },
                    },
                }
            ),
        },
        "open": INTEGER,
        "suspects": BOOLEAN,
    }
)

FETCH = strict(
    {
        "pulled": INTEGER,
        "already_pulled": INTEGER,
        "cells": INTEGER,
        "invalid": {"type": "array", "items": STRING},
        "fixture": {"type": "array", "items": STRING},
        "missing_photo": {"type": "array", "items": STRING},
        "stage": STRING,
        "table": STRING,
        "bucket": STRING,
    }
)

FIX = strict({"cells": INTEGER, "kept": INTEGER, "discarded": INTEGER})


def result(schema: dict) -> dict:
    """The answer of a POST route: `{"result": ...}`."""
    return strict({"result": schema})


ERROR = strict({"error": STRING, "sign_in": BOOLEAN, "detail": STRING}, ("sign_in", "detail"))
