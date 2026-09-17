import subprocess,time
base=['docker','exec','-i','railcommand-daily-log-20260917','psql','-U','postgres','-v','ON_ERROR_STOP=1','-At']
def run(sql):return subprocess.run(base,input=sql,text=True,capture_output=True)
assert run("update project_members set can_edit=true;").returncode==0
prefix="set role authenticated; select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false); "
def insert(n):return "select public.sync_daily_log_create('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-0000000000%s','daily-log-create:30000000-0000-4000-8000-0000000000%s','{\"log_date\":\"2026-09-17\"}');"%(n,n)
a=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
a.stdin.write('begin;'+prefix+insert('10')+' select pg_sleep(2);commit;');a.stdin.close()
time.sleep(.35)
b=run(prefix+insert('11'))
a.wait()
assert a.returncode==0,a.stderr.read()
assert b.returncode!=0 and 'RC_DAILY_LOG_SAME_DAY_CONFIRMATION' in b.stderr,b.stderr
result=run("select count(*) from daily_logs where log_date='2026-09-17';")
assert result.stdout.strip()=='1',result.stdout
print('PASS concurrent unconfirmed submissions: one created, second retained for review')
