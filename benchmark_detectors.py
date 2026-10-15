#!/usr/bin/env python3
"""
Scene Detector Benchmark Tool (`benchmark_detectors.py`)
========================================================
Compares scene detectors (`content`, `adaptive`, `ensemble`, `transnet`, `merge`)
against ground-truth hand-labelled cut timestamps (`cuts.txt`) and prints a
formatted table of Precision, Recall, and F1 score.

Usage:
    python benchmark_detectors.py video.mp4 cuts.txt [--tolerance 0.25] [--detectors content,adaptive,ensemble,transnet,merge]
"""

import argparse
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import dissect


def load_ground_truth_cuts(cuts_file: Path, total_duration: float) -> List[float]:
    """
    Load internal ground-truth cut timestamps (excluding 0.0 and total_duration) from `cuts.txt`.
    """
    scenes = dissect.load_cuts_from_file(cuts_file, total_duration=total_duration, min_scene_len_sec=0.05)
    internal_cuts = [round(sc[1], 3) for sc in scenes[:-1] if 0.05 < sc[1] < (total_duration - 0.05)]
    return sorted(set(internal_cuts))


def evaluate_cuts(
    predicted_cuts: List[float],
    ground_truth_cuts: List[float],
    tolerance_sec: float = 0.25
) -> Dict[str, float]:
    """
    Match predicted cut timestamps against ground-truth cuts within `+-tolerance_sec`
    using greedy 1-to-1 nearest-neighbour matching.
    Returns Precision, Recall, F1, TP, FP, FN.
    """
    matched_gt = set()
    tp = 0

    for p in sorted(predicted_cuts):
        best_idx = None
        best_dist = tolerance_sec + 1.0
        for g_idx, g in enumerate(ground_truth_cuts):
            if g_idx in matched_gt:
                continue
            d = abs(p - g)
            if d <= tolerance_sec and d < best_dist:
                best_dist = d
                best_idx = g_idx
        if best_idx is not None:
            matched_gt.add(best_idx)
            tp += 1

    fp = max(0, len(predicted_cuts) - tp)
    fn = max(0, len(ground_truth_cuts) - tp)

    precision = (tp / len(predicted_cuts)) if predicted_cuts else (1.0 if not ground_truth_cuts else 0.0)
    recall = (tp / len(ground_truth_cuts)) if ground_truth_cuts else (1.0 if not predicted_cuts else 0.0)
    f1 = (2.0 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "predicted_count": len(predicted_cuts),
        "gt_count": len(ground_truth_cuts),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4)
    }


def benchmark_video_detectors(
    video_path: Path,
    cuts_file: Path,
    detectors: List[str],
    threshold: float = 27.0,
    tolerance_sec: float = 0.25
) -> List[Dict[str, object]]:
    info = dissect.get_video_info(video_path)
    total_dur = float(info.get("duration", 0.0))
    fps = float(info.get("fps", 30.0))
    gt_cuts = load_ground_truth_cuts(cuts_file, total_duration=total_dur)

    rows: List[Dict[str, object]] = []
    for det in detectors:
        scenes = dissect.detect_scenes(
            video_path=video_path,
            total_duration=total_dur,
            threshold=threshold,
            min_scene_len_sec=0.3,
            detector_mode=det,
            segments=None,
            fps=fps,
            snap_to_speech=False
        )
        pred_cuts = [round(sc[1], 3) for sc in scenes[:-1]]
        metrics = evaluate_cuts(pred_cuts, gt_cuts, tolerance_sec=tolerance_sec)
        metrics["detector"] = det
        metrics["predicted_cuts"] = pred_cuts
        rows.append(metrics)

    return rows


def print_benchmark_table(rows: List[Dict[str, object]], tolerance_sec: float) -> None:
    print(f"\nScene Detector Benchmark (tolerance = +-{tolerance_sec:.2f}s)")
    print("-" * 74)
    print(f"{'Detector':<14} | {'GT Cuts':>7} | {'Pred':>6} | {'TP':>4} | {'FP':>4} | {'FN':>4} | {'Precision':>9} | {'Recall':>7} | {'F1':>6}")
    print("-" * 74)
    for r in rows:
        print(
            f"{str(r['detector']):<14} | {int(r['gt_count']):>7d} | {int(r['predicted_count']):>6d} | "
            f"{int(r['tp']):>4d} | {int(r['fp']):>4d} | {int(r['fn']):>4d} | "
            f"{float(r['precision']):>9.3f} | {float(r['recall']):>7.3f} | {float(r['f1']):>6.3f}"
        )
    print("-" * 74 + "\n")


def main(argv: List[str] = None) -> None:
    parser = argparse.ArgumentParser(description="Benchmark scene detectors against hand-labelled cuts.txt")
    parser.add_argument("video", type=str, help="Path to input video file")
    parser.add_argument("cuts", type=str, help="Path to ground-truth cuts.txt file")
    parser.add_argument("--tolerance", type=float, default=0.25, help="Matching tolerance in seconds (default: 0.25)")
    parser.add_argument("--threshold", type=float, default=27.0, help="PySceneDetect threshold (default: 27.0)")
    parser.add_argument(
        "--detectors",
        type=str,
        default="content,adaptive,ensemble,transnet,merge",
        help="Comma-separated detectors to benchmark"
    )
    args = parser.parse_args(argv)
    det_list = [d.strip() for d in args.detectors.split(",") if d.strip()]
    rows = benchmark_video_detectors(
        video_path=Path(args.video),
        cuts_file=Path(args.cuts),
        detectors=det_list,
        threshold=args.threshold,
        tolerance_sec=args.tolerance
    )
    print_benchmark_table(rows, tolerance_sec=args.tolerance)


if __name__ == "__main__":
    main()
