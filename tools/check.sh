#!/usr/bin/env bash
# Sthira release gate. Runs every automated check. Exit code 0 means ready to merge.
# Usage: bash tools/check.sh   (from the site folder or anywhere)
set -u
cd "$(dirname "$0")/.."
fail=0
step() { printf '\n== %s\n' "$1"; }
bad() { printf 'FAIL: %s\n' "$1"; fail=1; }

step "Logic tests (tests.js)"
node tests.js || bad "tests.js"

step "Plan and generator self checks"
tmp="$(mktemp)"
cat data.js plan.js generator.js > "$tmp"
STHIRA_CHECK=1 node "$tmp" || bad "self checks"
rm -f "$tmp"

step "Scripts in index.html exist and share no top level names"
python3 - <<'EOF' || fail=1
import re, sys, collections
html = open("index.html").read()
scripts = re.findall(r'<script[^>]*src="([^"]+)"', html)
missing = [s for s in scripts if not __import__("os").path.exists(s)]
names = collections.defaultdict(list)
for s in scripts:
    if s in missing:
        continue
    for m in re.finditer(r'^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', open(s).read(), re.M):
        names[m.group(1)].append(s)
dups = {k: v for k, v in names.items() if len(v) > 1}
for s in missing:
    print("missing script:", s)
for k, v in dups.items():
    print("duplicate top level name:", k, v)
print(len(scripts), "scripts checked")
sys.exit(1 if missing or dups else 0)
EOF

step "Service worker precache files exist"
python3 - <<'EOF' || fail=1
import re, os, sys
sw = open("sw.js").read()
block = re.search(r"SITE_FILES\s*=\s*\[(.*?)\]", sw, re.S)
files = re.findall(r'"(?:\./)?([^"]+\.(?:html|js|css|svg|png|webmanifest|json))"', block.group(1) if block else "")
missing = [f for f in files if not os.path.exists(f)]
for f in missing:
    print("missing precache file:", f)
print(len(files), "precache entries checked")
sys.exit(1 if missing else 0)
EOF

step "Copy rules (British house style, no dashes, no company names)"
python3 - <<'EOF' || fail=1
import os, re, sys
skip_dirs = {".git", "tools", "voice", "figures", ".shots", ".walk", ".figures-check", "node_modules"}
exts = (".js", ".html", ".css", ".md", ".webmanifest", ".json")
banned = "–—‘’“”"
brand = re.compile(r"\bcult\b|cure\.?fit|mind\.fit", re.I)
hits = 0
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for f in files:
        if not f.endswith(exts):
            continue
        p = os.path.join(root, f)
        for n, line in enumerate(open(p, encoding="utf8", errors="ignore"), 1):
            problems = []
            if ", and" in line:
                problems.append("comma before and")
            if any(c in line for c in banned):
                problems.append("dash or curly quote")
            if brand.search(line):
                problems.append("company name")
            if problems:
                hits += 1
                print(f"{p}:{n}: {', '.join(problems)}: {line.strip()[:100]}")
print(hits, "copy problems")
sys.exit(1 if hits else 0)
EOF

step "Result"
if [ "$fail" -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "CHECKS FAILED"; fi
exit "$fail"
