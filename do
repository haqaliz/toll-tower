#! /usr/bin/env python3

#===== imports =====#
import argparse
import collections
import copy
import datetime
import getpass
import glob
import hashlib
import json
import math
import os
import pprint
import random
import re
import shutil
import subprocess
import sys
import time

#===== args =====#
parser = argparse.ArgumentParser()
# setup
parser.add_argument('--full-dev-setup', '--fds', action='store_true')
parser.add_argument('--db-create', '--dbc', action='store_true')
parser.add_argument('--db-drop', '--dbd', action='store_true')
parser.add_argument('--db-user-create', '--dbuc', action='store_true')
parser.add_argument('--db-user-drop', '--dbud', action='store_true')
parser.add_argument('--db-fresh', '--dbf', action='store_true')
parser.add_argument('--db-migrate', '--dbm', action='store_true')
parser.add_argument('--dotenv-dev', '--ded', action='store_true')

# development
parser.add_argument('--run', '-r', action='store_true')
parser.add_argument('--sequelize-cli', '--seq', '-s')

# deploy
parser.add_argument('--docker-build', '--dkrb', action='store_true')
parser.add_argument('--docker-push', '--dkrp', action='store_true')
parser.add_argument('--deploy-staging', '--ds', choices=['only'], nargs='?', const=True)
parser.add_argument('--deploy-production', '--dp', choices=['only'], nargs='?', const=True)
parser.add_argument('--deploy-skip-migrate', action='store_true')

# config
parser.add_argument('--env', '-e', choices=['dev', 'stag', 'prod'], default='dev')

args = parser.parse_args()

if args.deploy_staging:
    args.env = 'stag'
elif args.deploy_production:
    args.env = 'prod'

#===== consts =====#
DIR = os.path.dirname(os.path.realpath(__file__))

DOCKER_REGISTRY = 'registry.bloomo.app'
DOCKER_REGISTRY_PW = 'QeOtLqfzR8Su$'
DOCKER_TAG = f'{DOCKER_REGISTRY}/bloomo-backend-{args.env}'

ENV_PATH = '/root/bloomo/env'
STATIC_PATH = '/bloomo/static'
POSTGRES_DATA_PATH = '/mnt/postgres-data'
POSTGRES_PW = 'QeOtLqfzR8Su$'

if args.env == 'dev':
    ORIGIN = 'http://localhost:8004'
elif args.env == 'stag':
    HOSTNAME = 'staging.bloomo.app'
elif args.env == 'prod':
    HOSTNAME = 'bloomo.app'

if args.env in ['stag', 'prod']:
    ORIGIN = f'https://{HOSTNAME}'
    USER_AT_HOSTNAME = f'root@{HOSTNAME}'

#===== setup =====#
os.chdir(DIR)

#===== helpers =====#
def blue(text):
    return '\x1b[34m' + text + '\x1b[0m'

def print_styled(string, end=None, style=None):
    if style: return print_styled(f'<{style}>{string}</>', end=end)
    def replace(match):
        if match.group(2) == '/': return match.group()
        if match.group(1) == '/': return '\x1b[0m'
        split = match.group(2).split('-')
        while len(split) < 2: split.append('none')
        color = split[0]
        background = split[1]
        decorations = split[2:]
        if color.startswith('#'):
            color = f'\x1b[38;5;{color[1:]}m'
        else: color = {
            'black': '\x1b[30m',
            'red': '\x1b[31m',
            'green': '\x1b[32m',
            'yellow': '\x1b[33m',
            'blue': '\x1b[34m',
            'magenta': '\x1b[35m',
            'cyan': '\x1b[36m',
            'white': '\x1b[37m',
            'lightblack': '\x1b[30;1m',
            'lightred': '\x1b[31;1m',
            'lightyellow': '\x1b[33;1m',
            'lightgreen': '\x1b[32;1m',
            'lightblue': '\x1b[34;1m',
            'lightmagenta': '\x1b[35;1m',
            'lightcyan': '\x1b[36;1m',
            'lightwhite': '\x1b[37;1m',
            'none': '',
        }[color]
        if background.startswith('#'):
            background = f'\x1b[48;5;{background[1:]}m'
        else: background = {
            'black': '\x1b[40m',
            'red': '\x1b[41m',
            'green': '\x1b[42m',
            'yellow': '\x1b[43m',
            'blue': '\x1b[44m',
            'magenta': '\x1b[45m',
            'cyan': '\x1b[46m',
            'white': '\x1b[47m',
            'lightblack': '\x1b[40;1m',
            'lightred': '\x1b[41;1m',
            'lightyellow': '\x1b[43;1m',
            'lightgreen': '\x1b[42;1m',
            'lightblue': '\x1b[44;1m',
            'lightmagenta': '\x1b[45;1m',
            'lightcyan': '\x1b[46;1m',
            'lightwhite': '\x1b[47;1m',
            'none': '',
        }[background]
        decorations = ''.join([
            {
                'bold': '\x1b[1m',
                'underlined': '\x1b[4m',
                'reversed': '\x1b[7m',
                'none': '',
            }[i]
            for i in decorations
        ])
        return color + background + decorations
    print(re.sub('<(/?)(.*?)>', replace, string) + '\x1b[0m', end=end)
    return re.sub('<(/?)(.*?)>', '', string)

def timestamp():
    return '{:%Y-%m-%d %H:%M:%S.%f}'.format(datetime.datetime.now())

def invoke(
    *args,
    popen=False,
    no_split=False,
    stdout=False,
    quiet=False,
    **kwargs,
):
    if len(args) == 1 and not no_split:
        args = args[0].split()
    if not quiet:
        print(blue('-'*40))
        print(timestamp())
        print(os.getcwd()+'$', end=' ')
        if any([re.search(r'\s', i) for i in args]):
            print()
            for i in args: print(f'\t{i} \\')
        else:
            for i, v in enumerate(args):
                if i != len(args)-1:
                    end = ' '
                else:
                    end = ';\n'
                print(v, end=end)
        if kwargs: print(kwargs)
        if popen: print('popen')
        print()
    if kwargs.get('env') != None:
        env = copy.copy(os.environ)
        env.update(kwargs['env'])
        kwargs['env'] = env
    if popen:
        return subprocess.Popen(args, **kwargs)
    else:
        if 'check' not in kwargs: kwargs['check'] = True
        if stdout: kwargs['capture_output'] = True
        result = subprocess.run(args, **kwargs)
        if stdout:
            result = result.stdout.decode('utf-8')
            if stdout != 'exact': result = result.strip()
        return result

def invoke_target(*args, **kwargs):
    return invoke('ssh', USER_AT_HOSTNAME, ' '.join(args), **kwargs)

def cp_to_target(src, dst, quiet=False):
    invoke('scp', src, f'{USER_AT_HOSTNAME}:{dst}', quiet=quiet, stdout=quiet)

def psqlc(command, db='', quiet=False, use_file=False):
    if not quiet: print(command)
    if use_file:
        with open('command.sql', 'w') as file: file.write(command)
    invocation = ['su', 'postgres', '-c']
    if use_file:
        invocation.append(f'psql {db} -f command.sql')
    else:
        invocation.append(f'psql {db} -c "{command}"')
    if getpass.getuser() != 'root':
        invocation.insert(0, 'sudo')
    invoke(*invocation, quiet=quiet)

def psqlc_target(command, options='', quiet=False, use_file=False):
    if not quiet: print(command)
    if args.db_dry_sql: return
    if use_file:
        with open('command.sql', 'w') as file: file.write(command)
        cp_to_target('command.sql', '.', quiet=True)
        invoke_target('docker cp command.sql portal2-backend-db:command.sql', quiet=True)
    separator = f'({UUID})'
    result = invoke_target(
        ' '.join([
            'docker exec portal2-backend-db',
                f'psql {dotenv_get("DB")} {dotenv_get("DB_USER")}',
                    '-f command.sql' if use_file else f'-c "{command}"',
                    '-t',
                    '--no-align',
                    f'-F "{separator}"',
                    options,
        ]),
        stdout=True,
        quiet=True,
    )
    return [line.split(separator) for line in result.splitlines()]

def dotenv_get(var):
    with open('env/env') as env:
        lines = env.readlines()
    for line in lines:
        if line.startswith(var+'='):
            return line[len(var)+1:].strip()

def git_state():
    diff = invoke('git diff', stdout=True)
    diff_cached = invoke('git diff --cached', stdout=True)
    with open('git-state', 'w') as git_state:
        git_state.write(invoke('git show --name-only', stdout=True)+'\n')
        if diff:
            git_state.write('\n===== diff =====\n')
            git_state.write(diff+'\n')
        if diff_cached:
            git_state.write('\n===== diff --cached =====\n')
            git_state.write(diff_cached+'\n')

#===== main =====#
if len(sys.argv) == 1:
    parser.print_help()
    sys.exit()

if args.full_dev_setup:
    invoke('npm ci')

if args.dotenv_dev or args.full_dev_setup:
   shutil.copy('env/dev', 'env/env')

if args.db_drop or args.db_fresh:
    psqlc(f'DROP DATABASE {dotenv_get("DB")}')

if args.db_user_drop or args.db_fresh:
    psqlc(f'DROP USER {dotenv_get("DB_USER")}')

if args.db_create or args.full_dev_setup or args.db_fresh:
    psqlc(f'CREATE DATABASE {dotenv_get("DB")};')

if args.db_user_create or args.full_dev_setup or args.db_fresh:
    db_user = dotenv_get('DB_USER')
    psqlc(f'''CREATE USER {db_user} WITH PASSWORD '{dotenv_get("DB_PW")}';''')
    psqlc(f'GRANT ALL PRIVILEGES ON DATABASE {dotenv_get("DB")} TO {db_user};')

if args.full_dev_setup or args.db_fresh:
    invoke('npx sequelize-cli db:migrate')

if args.run:
    invoke(f'npx nodemon src/index.js')

if args.sequelize_cli:
    invoke(f'npx sequelize-cli')

if args.docker_build or args.deploy_staging == True or args.deploy_production == True:
    git_state()
    invoke(f'docker image rm {DOCKER_TAG}', check=False)
    invoke(f'docker build -t {DOCKER_TAG} .')

if args.docker_push or args.deploy_staging == True or args.deploy_production == True:
    invoke(f'docker login -u bloomo -p {DOCKER_REGISTRY_PW} {DOCKER_REGISTRY}')
    invoke(f'docker push {DOCKER_TAG}')

if args.deploy_staging or args.deploy_production:
    invoke_target('mkdir bloomo', check=False)
    git_state()
    for i in [
        'do',
        'docker-compose.yml',
        'git-state'
    ]:
        cp_to_target(i, 'bloomo')
    invoke_target(f'docker login -u bloomo -p {DOCKER_REGISTRY_PW} {DOCKER_REGISTRY}')
    invoke_target(f'docker pull {DOCKER_TAG}')
    invoke_target(' '.join([
        f'POSTGRES_DATA_PATH={POSTGRES_DATA_PATH}',
        f'DOCKER_TAG={DOCKER_TAG}',
        f'ENV_PATH={ENV_PATH}',
        f'STATIC_PATH={STATIC_PATH}',
        'docker-compose -f bloomo/docker-compose.yml up -d',
    ]))
    if not args.deploy_skip_migrate:
        invoke_target(f'docker exec bloomo-main npx sequelize-cli db:migrate')
    invoke_target('docker system prune --force')
