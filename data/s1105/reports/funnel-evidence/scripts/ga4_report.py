import base64, json, sys, time, urllib.parse, urllib.request, urllib.error
KEY = '/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json'
SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
PROP = '561638567'
def b64(b): return base64.urlsafe_b64encode(b).rstrip(b'=')
def token():
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    adc = json.load(open(KEY)); now = int(time.time())
    claim = {'iss': adc['client_email'], 'scope': SCOPE, 'aud': adc['token_uri'], 'exp': now+3600, 'iat': now}
    hdr = b64(json.dumps({'alg':'RS256','typ':'JWT'}).encode()); pl = b64(json.dumps(claim).encode())
    key = serialization.load_pem_private_key(adc['private_key'].encode(), password=None)
    sig = b64(key.sign(hdr+b'.'+pl, padding.PKCS1v15(), hashes.SHA256()))
    data = urllib.parse.urlencode({'grant_type':'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion':(hdr+b'.'+pl+b'.'+sig).decode()}).encode()
    try:
        return json.loads(urllib.request.urlopen(urllib.request.Request(adc['token_uri'], data=data), timeout=30).read())['access_token']
    except urllib.error.HTTPError as e:
        print('TOKEN HTTP', e.code, e.read().decode()[:300]); sys.exit(2)
def run(tok, body):
    req = urllib.request.Request(f'https://analyticsdata.googleapis.com/v1beta/properties/{PROP}:runReport', method='POST',
        data=json.dumps(body).encode(), headers={'Authorization':'Bearer '+tok,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]
tok = token()
print('token minted: yes (not printed)')
st, r = run(tok, {'dateRanges':[{'startDate':'14daysAgo','endDate':'today'}],
    'dimensions':[{'name':'eventName'}], 'metrics':[{'name':'eventCount'},{'name':'totalUsers'}], 'limit':100})
print('HTTP', st)
print(json.dumps(r, indent=1)[:3000] if not isinstance(r,str) else r)
