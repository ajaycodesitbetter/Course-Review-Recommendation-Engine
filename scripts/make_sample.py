import os
import pandas as pd
import numpy as np

SAMPLE_ROWS = int(os.getenv("SAMPLE_ROWS", "15000"))
RANDOM_STATE = 42

ROOT = os.getcwd()

FEATHER_IN = os.path.join(ROOT, "courses_data.feather")
CSV_IN = os.path.join(ROOT, "courses_data.csv")

FEATHER_OUT = os.path.join(ROOT, "courses_data.sample.feather")
CSV_OUT = os.path.join(ROOT, "courses_data.sample.csv")
ZIP_OUT = os.path.join(ROOT, "courses_data.sample.feather.zip")


def main():
    if os.path.exists(FEATHER_IN):
        df = pd.read_feather(FEATHER_IN)
        src = FEATHER_IN
    elif os.path.exists(CSV_IN):
        df = pd.read_csv(CSV_IN)
        src = CSV_IN
    else:
        raise SystemExit("No courses_data.feather or courses_data.csv found in repo root.")

    n = len(df)
    k = min(SAMPLE_ROWS, n)

    # Stable sample: if dataset smaller than k, just use all rows
    if n > k:
        df_sample = df.sample(n=k, random_state=RANDOM_STATE)
    else:
        df_sample = df

    # Write feather first (preferred for runtime)
    df_sample.reset_index(drop=True).to_feather(FEATHER_OUT)

    # Also write CSV (optional, for inspection)
    df_sample.to_csv(CSV_OUT, index=False)

    # Zip the feather for easier upload limits
    import zipfile
    with zipfile.ZipFile(ZIP_OUT, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
        z.write(FEATHER_OUT, arcname=os.path.basename(FEATHER_OUT))

    # Print sizes
    def size(p):
        return os.path.getsize(p) if os.path.exists(p) else 0

    print("SOURCE:", src, size(src))
    print("FEATHER_OUT:", FEATHER_OUT, size(FEATHER_OUT))
    print("CSV_OUT:", CSV_OUT, size(CSV_OUT))
    print("ZIP_OUT:", ZIP_OUT, size(ZIP_OUT))


if __name__ == "__main__":
    main()
