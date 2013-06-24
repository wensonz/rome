#!/usr/bin/env python26

import sys
import os
import urllib2
import urllib
import json
import traceback
import socket
import random
import tarfile

import salt
import salt.cli

import config # load the local config.py

def usage():
    print '''
NAME
    rome-config-sync  -  client tool for configuration update and sync

SYNOPSIS
    rome-config-sync [TAG] [-h|--help]

OPTIONS
    TAG             The TAG for the new configuration to be generated, updated 
                    and synced. If it's not provided, current configuration is 
                    to be synced in order to keep the configuration unchanged.
            
    -h | --help     Print this help
    
'''

def getUrl ():
    host = hasattr(config, 'host') and config.host or 'api.rome.cluster.sina.com.cn'
    port = hasattr(config, 'port') and config.port or 8080
    try:
        addresses = socket.gethostbyname_ex(host)[2]
    except:
        print '>>> Getting ip addresses for host %s failed. Traceback: ' % (host)
        traceback.print_exc()
        sys.exit(1)
    
    index = random.randint(0, len(addresses) - 1)
    return 'http://%s:%d/' % (addresses[index], port)
    

def updateConfiguration (url, tag):
    try:
        body = json.dumps({ 'tag': tag, 'node': config.id });
        request = urllib2.Request(url + 'configuration/generate', body, {
            'Content-Type': 'application/json',
            'Content-Length': str(len(body))
        })
        response = urllib2.urlopen(request)
        body = response.read()
        response.close()
        content = json.loads(body)
    except:
        print '>>> Generating new configuration with TAG %s failed. Traceback:' % (tag)
        traceback.print_exc()
        sys.exit(1)
    
    if 'error' in content:
        print '>>> Generating configuration with TAG %s failed. Error: ' % (tag)
        print '  * code: %n, message: %s' % (content['error']['code'], 
                                             content['error']['message'])
        sys.exit(1)
        return
    
    name = content['result']
    
    # Get the generated configuration tar ball on the server
    try:
        remote = config.tarballs['remote'] + '/' + name + '.tar.gz'
        local = config.tarballs['local'] + '/' + name + '.tar.gz'
        
        urllib.urlretrieve(url + remote, local)
    except:
        print '>>> Downloading the genreated tarball %s%s failed. Traceback: ' % (url, remote)
        traceback.print_exc()
        sys.exit(1)
    
    # Extract the downloaded tarball
    try:
        targz = tarfile.open(local)
        targz.extractall(config.tarballs['local'])
        targz.close()
    except:
        print '>>> Extracting downloaded configuration tarball %s failed.' % (local)
        traceback.print_exc()
        sys.exit(1)
    
    directory = config.tarballs['local'] + '/' + name
    # Update the link of salt to this new dir
    try:
        os.chdir(config.salt['root'])
        os.symlink(directory, config.salt['config'])
    except:
        print '>>> Linking the salt config root %s to %s failed. Traceback: ' % (config.salt['config'], directory)
        traceback.print_exc()
        sys.exit(1)
    

def deployConfiguration ():
    
    sys.argv = ['salt-call', '--local', 'highstate']
    try:
        client = salt.cli.SaltCall()
        client.config['retcode_passthrough'] = True
        client.run()
    except:
        print '>>> Syncing the configuration with salt-call failed. Traceback: '
        traceback.print_exc()
        sys.exit(1)
    

def main ():
    tag = None
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '-h' or sys.argv[1] == '--help':
            usage()
            sys.exit(0)
        else:
            tag = sys.argv[1]
    
    if tag:
        url = getUrl()
        updateConfiguration(url, tag)
    
    deployConfiguration()
    

if __name__ == '__main__':
    main()