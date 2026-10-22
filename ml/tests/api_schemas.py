"""JSON Schemas of the label server answers. They mirror `tools/label-app/src/api/types.ts`: a
change of one needs the same change in the other (ADR-034)."""

NUMBER = {"type": "number"}
INTEGER = {"type": "integer"}
STRING = {"type": "string"}
BOOLEAN = {"type": "boolean"}
NULLABLE_STRING = {"type": ["string", "null"]}
SOURCE = {"enum": ["app", "photo"]}
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
        "scans": INTEGER,
        "scan_cells": INTEGER,
        "not_prelabelled": INTEGER,
        "digits": INTEGER,
        "kind": INTEGER,
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

SCANS = strict(
    {
        "scans": {
            "type": "array",
            "items": strict(
                {"photo": STRING, "source": SOURCE, "open": INTEGER, "edited": INTEGER}
            ),
        }
    }
)

PLACE = {"row": INTEGER, "col": INTEGER}
SCAN = strict(
    {
        **OUTLINE["properties"],
        "cells": {
            "type": "array",
            "items": {
                "oneOf": [
                    strict({**PLACE, "missing": {"const": True}}),
                    strict(
                        {
                            **PLACE,
                            "id": STRING,
                            "stem": STRING,
                            "digit": NULLABLE_STRING,
                            "kind": NULLABLE_STRING,
                            "suggested": BOOLEAN,
                            "edited": BOOLEAN,
                            "reviewed": BOOLEAN,
                            "shared": NULLABLE_STRING,
                            "locked": BOOLEAN,
                        }
                    ),
                ]
            },
        },
    }
)

DIGITS = strict(
    {
        "digit": STRING,
        "kinds": STRING,
        "cells": {
            "type": "array",
            "items": strict({"id": STRING, "stem": STRING, "p": NUMBER}),
        },
        "left": INTEGER,
        "counts": {"type": "object", "additionalProperties": INTEGER},
        "not_prelabelled": INTEGER,
    }
)

KINDS = {
    "oneOf": [
        {"type": "null"},
        strict(
            {
                "folder": STRING,
                "group": INTEGER,
                "groups": INTEGER,
                "page": INTEGER,
                "pages": INTEGER,
                "ungrouped": BOOLEAN,
                "predicted": NULLABLE_STRING,
                "cells": {
                    "type": "array",
                    "items": strict(
                        {
                            "id": STRING,
                            "stem": STRING,
                            "kind": NULLABLE_STRING,
                            "start": NULLABLE_STRING,
                            "least_sure": BOOLEAN,
                            "kp": NUMBER,
                            "model_kind": STRING,
                        },
                        optional=("kp", "model_kind"),
                    ),
                },
                "progress": strict({"cells": INTEGER, "labelled": INTEGER}),
            }
        ),
    ]
}

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
