"""Fail the scheduled job if the generated catalog never reaches production."""
import hashlib
import time
from pathlib import Path
from urllib.request import Request, urlopen

expected = hashlib.sha256(Path('../assets/data/propiedades.json').read_bytes()).hexdigest()
for attempt in range(30):
    try:
        req = Request('https://www.giofilio.com/assets/data/propiedades.json?sync=' + expected[:16], headers={'Cache-Control': 'no-cache'})
        with urlopen(req, timeout=15) as response:
            actual = hashlib.sha256(response.read()).hexdigest()
        if actual == expected:
            print('Verified: generated inventory is live on www.giofilio.com')
            break
    except Exception as error:
        print('Publication check retry:', type(error).__name__)
    time.sleep(10)
else:
    raise SystemExit('Inventory generated but NOT published after 5 minutes; inspect Vercel deployment.')
