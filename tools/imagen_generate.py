"""
Vertex AI Image Generation Script (Cost-Controlled)
====================================================
This script generates images using the Google Vertex AI Imagen API.
It includes a HARD MONTHLY CAP to prevent any accidental billing.

Usage:
    python imagen_generate.py "Your prompt here" [output_path.png]

Safety Features:
    1.  Monthly usage is tracked in a JSON file.
    2.  A hard cap of 2500 images/month ($0.25 at $0.0001/image) is enforced.
    3.  Within $300 free trial credit, this is $0 cost.
    4.  If the cap is hit, the script refuses to generate.

Created: 2025-12-28
Project: AC Tech - TechAI Media Pipeline
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# --- CONFIGURATION ---
PROJECT_ID = "techair-actech"
LOCATION = "us-central1"
MODEL_ID = "imagegeneration@006"  # Imagen 3

# Cost Controls
MONTHLY_CAP = 2500  # Max images per month (Safety buffer: 2500 * $0.0001 = $0.25/month)
USAGE_FILE = Path("D:/TechAI/Credentials/imagen_usage.json")

# Credentials
CREDENTIALS_FILE = Path("D:/TechAI/Credentials/TechAir Vertex JSON API Key.json")


def load_usage() -> dict:
    """Load usage data from JSON, initializing if needed."""
    if USAGE_FILE.exists():
        with open(USAGE_FILE, "r") as f:
            return json.load(f)
    return {"month": datetime.now().strftime("%Y-%m"), "count": 0}


def save_usage(usage: dict):
    """Save usage data to JSON."""
    with open(USAGE_FILE, "w") as f:
        json.dump(usage, f, indent=2)


def check_and_increment_usage() -> bool:
    """Check usage against cap. Increment if allowed. Return True if allowed."""
    usage = load_usage()
    current_month = datetime.now().strftime("%Y-%m")

    # Reset count if new month
    if usage.get("month") != current_month:
        usage = {"month": current_month, "count": 0}

    if usage["count"] >= MONTHLY_CAP:
        print(f"❌ MONTHLY CAP REACHED ({MONTHLY_CAP} images). No billing will occur.")
        print(f"   Current usage: {usage['count']} / {MONTHLY_CAP}")
        return False

    usage["count"] += 1
    save_usage(usage)
    print(f"✅ Usage: {usage['count']}/{MONTHLY_CAP} this month.")
    return True


def generate_image(prompt: str, output_path: str = "output.png"):
    """Generate an image using Vertex AI Imagen."""
    # 1. Check usage cap FIRST
    if not check_and_increment_usage():
        sys.exit(1)

    # 2. Set credentials
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(CREDENTIALS_FILE)

    # 3. Import Vertex AI (late import to avoid errors if not installed)
    try:
        import vertexai
        from vertexai.preview.vision_models import ImageGenerationModel
    except ImportError:
        print("❌ ERROR: google-cloud-aiplatform not installed.")
        print("   Run: pip install google-cloud-aiplatform")
        sys.exit(1)

    # 4. Initialize Vertex AI
    print(f"🔄 Initializing Vertex AI (Project: {PROJECT_ID})...")
    vertexai.init(project=PROJECT_ID, location=LOCATION)

    # 5. Load model and generate
    print(f"🎨 Generating image for prompt: '{prompt[:50]}...'")
    model = ImageGenerationModel.from_pretrained(MODEL_ID)
    images = model.generate_images(prompt=prompt, number_of_images=1)

    # 6. Save image
    images[0].save(output_path)
    print(f"✅ Image saved to: {output_path}")
    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python imagen_generate.py \"Your prompt\" [output.png]")
        sys.exit(1)

    user_prompt = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "output.png"
    generate_image(user_prompt, out_path)
