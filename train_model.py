"""
train_model.py
Corrected & calibrated version – realistic traffic prediction
"""

import os
import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
from sklearn.preprocessing import OrdinalEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import joblib

# ---------------- CONFIG ----------------
DATA_PATH = "data/tfdata_sorted.csv"
OUT_MODEL_DIR = "models"
MODEL_OUT = os.path.join(OUT_MODEL_DIR, "traffic_model.pkl")
ENC_OUT = os.path.join(OUT_MODEL_DIR, "encoders.pkl")
AREA_STATS_OUT = os.path.join(OUT_MODEL_DIR, "area_stats.pkl")

TARGET = "traffic_percentage"
RANDOM_STATE = 42

os.makedirs(OUT_MODEL_DIR, exist_ok=True)

# ---------------- LOAD DATA ----------------
df = pd.read_csv(DATA_PATH, parse_dates=["timestamp"])

required = [
    "timestamp", "area", "vehicles",
    "traffic_percentage", "avg_speed_kmph",
    "weather", "temperature_c"
]

for col in required:
    if col not in df.columns:
        raise RuntimeError(f"Missing column: {col}")

df = df.drop_duplicates().sort_values("timestamp")

# 🔴 IMPORTANT FIX 1: realistic target bounds
# Traffic rarely stays at 0% or 100% in cities
df[TARGET] = df[TARGET].clip(10, 90)

# ---------------- TIME FEATURES ----------------
df["hour"] = df["timestamp"].dt.hour
df["dayofweek"] = df["timestamp"].dt.weekday
df["month"] = df["timestamp"].dt.month
df["is_weekend"] = (df["dayofweek"] >= 5).astype(int)
df["is_morning_rush"] = ((df["hour"] >= 7) & (df["hour"] <= 9)).astype(int)
df["is_evening_rush"] = ((df["hour"] >= 17) & (df["hour"] <= 20)).astype(int)

# ---------------- FEATURES ----------------
num_features = [
    "hour", "dayofweek", "month",
    "is_weekend", "is_morning_rush", "is_evening_rush",
    "vehicles", "avg_speed_kmph", "temperature_c"
]

cat_features = ["area", "weather"]
features = num_features + cat_features

# ---------------- ENCODING ----------------
encoder = OrdinalEncoder(
    handle_unknown="use_encoded_value",
    unknown_value=-1
)
df[cat_features] = encoder.fit_transform(df[cat_features].astype(str))

# ---------------- TIME AWARE SPLIT ----------------
split_time = df["timestamp"].quantile(0.9)

train_df = df[df["timestamp"] <= split_time]
val_df = df[df["timestamp"] > split_time]

X_train = train_df[features]
y_train = train_df[TARGET]
X_val = val_df[features]
y_val = val_df[TARGET]

# ---------------- TRAIN MODEL ----------------
dtrain = xgb.DMatrix(X_train, label=y_train)
dval = xgb.DMatrix(X_val, label=y_val)

params = {
    "objective": "reg:squarederror",
    "max_depth": 7,              # reduced overfitting
    "learning_rate": 0.06,       # smoother learning
    "subsample": 0.85,
    "colsample_bytree": 0.85,
    "gamma": 0.15,
    "min_child_weight": 4,
    "seed": RANDOM_STATE
}

model = xgb.train(
    params,
    dtrain,
    num_boost_round=350,
    evals=[(dtrain, "train"), (dval, "val")],
    early_stopping_rounds=25,
    verbose_eval=True
)

# ---------------- EVALUATION ----------------
pred = model.predict(dval)

# 🔴 IMPORTANT FIX 2: prediction calibration
pred = np.clip(pred, 10, 85)

print("MAE :", round(mean_absolute_error(y_val, pred), 2))
print("RMSE:", round(np.sqrt(mean_squared_error(y_val, pred)), 2))
print("R2  :", round(r2_score(y_val, pred), 3))

# ---------------- SAVE ----------------
joblib.dump(
    {"model": model, "features": features},
    MODEL_OUT
)

joblib.dump(
    {
        "ordinal_encoder": encoder,
        "cat_features": cat_features
    },
    ENC_OUT
)

# ---------------- AREA STATS ----------------
area_stats = df.groupby("area")[TARGET].agg(
    area_mean="mean",
    area_std="std"
).reset_index()

joblib.dump(area_stats, AREA_STATS_OUT)

print("✅ Training complete with corrected accuracy")
