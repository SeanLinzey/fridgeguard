import base64
import json
import os
import traceback

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "FridgeGuard backend is running"
    }), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True}), 200


@app.route("/api/analyze-fridge", methods=["POST"])
def analyze_fridge():
    try:
        print("ANALYZE: request received")

        if "image" not in request.files:
            print("ANALYZE: no image uploaded")
            return jsonify({"error": "No image uploaded"}), 400

        image_file = request.files["image"]
        print("ANALYZE: got image", image_file.filename)

        image_bytes = image_file.read()
        print("ANALYZE: read bytes", len(image_bytes))

        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = image_file.mimetype or "image/jpeg"

        print("ANALYZE: sending image to OpenAI")

        response = client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Look at this fridge photo and identify clearly visible "
                                "food items. Estimate daysLeft reasonably for each item. "
                                "Return JSON only."
                            ),
                        },
                        {
                            "type": "input_image",
                            "image_url": (
                                f"data:{mime_type};base64,{image_base64}"
                            ),
                        },
                    ],
                }
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "fridge_items",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "items": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "daysLeft": {"type": "integer"},
                                    },
                                    "required": ["name", "daysLeft"],
                                    "additionalProperties": False,
                                },
                            }
                        },
                        "required": ["items"],
                        "additionalProperties": False,
                    },
                }
            },
        )

        print("ANALYZE: OpenAI returned successfully")
        print("ANALYZE OUTPUT:", response.output_text)

        return app.response_class(
            response=response.output_text,
            status=200,
            mimetype="application/json"
        )

    except Exception as e:
        print("=== ANALYZE ERROR START ===")
        traceback.print_exc()
        print("=== ANALYZE ERROR END ===")
        return jsonify({"error": str(e)}), 500


@app.route("/api/recipes", methods=["POST"])
def recipes():
    try:
        print("RECIPES: request received")

        data = request.get_json() or {}
        items = data.get("items", [])

        ingredient_names = [
            item.get("name", "")
            for item in items
            if item.get("name", "")
        ]

        print("RECIPES: ingredient names =", ingredient_names)

        if not ingredient_names:
            print("RECIPES: no ingredients found")
            return jsonify({
                "recipes": [
                    "Try taking a clearer photo",
                    "No ingredients detected yet",
                    "Analyze again for recipe ideas"
                ]
            })

        ingredient_text = ", ".join(ingredient_names)

        print("RECIPES: sending recipe request to OpenAI")

        response = client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                f"Using these fridge ingredients: {ingredient_text}. "
                                "Generate exactly 3 realistic meal ideas based mainly "
                                "on these ingredients. You may assume pantry basics "
                                "like salt, pepper, oil, and water."
                            ),
                        }
                    ],
                }
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "recipe_ideas",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "recipes": {
                                "type": "array",
                                "items": {"type": "string"},
                            }
                        },
                        "required": ["recipes"],
                        "additionalProperties": False,
                    },
                }
            },
        )

        print("RECIPES: OpenAI returned successfully")
        print("RECIPES OUTPUT:", response.output_text)

        parsed = json.loads(response.output_text)

        cleaned = [
            str(recipe).strip()
            for recipe in parsed["recipes"]
            if str(recipe).strip()
        ]

        if not cleaned:
            raise ValueError("Recipe list was empty")

        return jsonify({"recipes": cleaned[:3]})

    except Exception as e:
        print("=== RECIPES ERROR START ===")
        traceback.print_exc()
        print("=== RECIPES ERROR END ===")

        fallback = []
        names_lower = [
            name.lower() for name in ingredient_names
        ] if "ingredient_names" in locals() else []

        joined_names = " ".join(names_lower)

        if "egg" in joined_names:
            fallback.append("Veggie omelet")
        if "tomato" in joined_names or "pepper" in joined_names:
            fallback.append("Roasted veggie skillet")
        if "lettuce" in joined_names or "spinach" in joined_names:
            fallback.append("Fresh fridge salad")

        while len(fallback) < 3:
            fallback.append("Simple fridge stir-fry")

        return jsonify({"recipes": fallback[:3]})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)