import pandas as pd

INPUT_FILE = "data/tfdata.csv"
OUTPUT_FILE = "data/tfdata_sorted.csv"

# Your timestamp format = DD-MM-YYYY HH:MM   (example: 22-10-2024 07:34)
df = pd.read_csv(INPUT_FILE)

# Convert using the exact format
df["timestamp"] = pd.to_datetime(df["timestamp"], format="%d-%m-%Y %H:%M")

# Sort by timestamp (oldest → newest)
df = df.sort_values("timestamp").reset_index(drop=True)

# Save sorted file
df.to_csv(OUTPUT_FILE, index=False)

print("Dataset sorted successfully!")
print("Saved to:", OUTPUT_FILE)
