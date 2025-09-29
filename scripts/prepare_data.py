#!/usr/bin/env python3
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(ROOT, '..'))

DATA_FEATHER = os.path.join(ROOT, 'courses_data.sample.feather')
DATA_ZIP = os.path.join(ROOT, 'courses_data.sample.feather.zip')

if not os.path.exists(DATA_FEATHER) and os.path.exists(DATA_ZIP):
    print('Unzipping courses_data.sample.feather.zip ...')
    with zipfile.ZipFile(DATA_ZIP, 'r') as zf:
        zf.extractall(ROOT)
    print('Done.')
else:
    print('No unzip required.')
