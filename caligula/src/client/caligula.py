#!/bin/env python26

import commands
import getopt
import sys
import json
import os
import os.path
import urllib2
import re
import yaml
from salt.scripts import salt_call

# CONSTANTS {{{1
HTTP_RETRY_TIMES = 3
HTTP_RETRY_INTERVAL = 1
LOCAL_SLS_PATH = "/srv/salt"
HTTP_TIMEOUT = 30
API = "http://api.rome.cluster.sina.com.cn:8080/generation"

# Functions {{{1
def retry(times=1, interval=0): # {{{2
    def _retry(func):
        def wrapper(*args, **argkw):
            response = None
            for i in range(times):
                response = func(*args, **argkw)
                if response:
                    break
                time.sleep(interval)
            return response

        return wrapper
    return _retry

@retry(HTTP_RETRY_TIMES, HTTP_RETRY_INTERVAL)
def request(url, data=None, post_json=False, accept_json=False, out=None): #{{{2

    headers = {}

    if post_json and data:
        data = json.dumps(data)
        headers['Content-Type'] = 'application/json'

    req = urllib2.Request(url=url, data=data, headers = headers)

    try:
        response = urllib2.urlopen(req, timeout=HTTP_TIMEOUT)
    except urllib2.HTTPError as e:
        # urllib2.HTTPError is a file like object.
        response = e

    content = response.read()
    if accept_json:
        content = json.loads(content)

    if out:
        assert type(out) == types.FileType
        out.write(content)

    return content

def generate(api, node, tag=None): #{{{2
    data = { "node": node}
    if tag:
        data["tag"] = tag

    errmsg = 'Generate faild. Api return %s'
    response = request(api, data, post_json=True, accept_json=True)
    if not response:
        raise CaligulaClientError(errmsg % response)

    if response.has_key("error"):
        raise CaligulaClientError(errmsg % response["error"])

    if not response.has_key("result"):
        raise CaligulaClientError(errmsg % json.dumps(response))

    #return response["result"][node]

def syn_sls(generate_result): # {{{2
    """
    sync sls tree from master using rsync
    """
    # TODO: get path from generate_result, no mock
    rsync_path = "api.rome.cluster.sina.com.cn::salt/10.210.214.96/*"

    if not rsync_path:
        raise CaligulaClientError("Can't find usable rsync path")

    status, output = commands.getstatusoutput('rsync -a %s %s' %
            (rsync_path, LOCAL_SLS_PATH))
    if status == 0:
        create_top_sls()
        return True
    else:
        raise CaligulaClientError("Rsync sls files from master faild." +
                "url: %s, output: %s" % output)

def run_saltcall(): # {{{2
    """
    call salt_call command to apply sls, like salt-call command.

    """
    pid = os.fork()
    if pid == 0:
        sys.argv = ['salt-call', '--local', 'state.highstate']
        salt_call()
    else:
        pid, status = os.wait()
        if status == 0:
            ret = True
        else:
            ret = False

        return ret

def create_top_sls(): #{{{2
    file_list = os.listdir(LOCAL_SLS_PATH)
    dir_list = [i for i in file_list
            if os.path.isdir('%s/%s' % (LOCAL_SLS_PATH, i))]
    top_sls = {'base': {'*': dir_list}}
    with open(LOCAL_SLS_PATH + '/top.sls', 'w') as f:
        f.write(yaml.dump(top_sls))

def get_ip(dev): #{{{2
    res = []
    interfaces = commands.getstatusoutput("ip ad sh dev %s" % dev)
    if os.WIFEXITED(interfaces[0]):
        interfaces = re.split(r'(?<!\w)\d: ', interfaces[1])
        for interface in interfaces:
            dev = re.match(r'([\S]+): ', interface)
            if not dev:
                continue
            dev = dev.groups()[0]
            if dev == 'lo':
                continue
            for i in interface.splitlines():
                ip = re.search(r'inet ([0-9.]+).*global [\w]+$', i)
                if ip:
                    res.insert(0, ip.groups()[0])
                    continue
                ip = re.search(r'inet ([0-9.]+)', i)
                if ip:
                    res.append(ip.groups()[0])
    return res

def get_assetcode(): #{{{2
    return open('/etc/sinainstall.conf').readline().strip().split('=')[1]

def get_node_name(): #{{{2
    return get_ip('eth0')[0]

def usage(): #{{{2
    print "usage: %s [-t tag] [--disable-sync]" % sys.argv[0]

def main(): # {{{2
    sync = True
    tag = None

    optlist, args = getopt.getopt(sys.argv[1:], 't:h', ['disable-sync', 'help'])
    for arg_i in optlist:
        if arg_i[0] == "-h" or arg_i[0] == 'help':
            usage()
            sys.exit()
        if arg_i[0] == "disable-sync":
            sync = True
        if arg_i[0] == "-t":
            tag = arg_i[1]

    if sync:
        syn_sls(generate(API, get_node_name()))

    if run_saltcall():
        pass # move tag

# Exceptions {{{1

class CaligulaClientError(Exception): #{{{2
    def __init__(self, message):
        self.message = message

    def __str__(self):
        return repr(self.message)


if __name__ == '__main__':
    main()
