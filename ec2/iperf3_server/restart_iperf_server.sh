#!/usr/bin/env bash

/bin/sleep 10
/usr/bin/killall iperf3
/bin/sleep 0.1
/usr/bin/killall -9 iperf3
/bin/sleep 0.1

if [ `ps -C iperf3 | wc -l` = "1" ]
then
    for idx in {0..26}
    do
        start_port=5200
        port=$(($idx+$start_port))

        /usr/bin/sudo -u nobody /usr/bin/iperf3 -s -p $port -D >/dev/null 2>&1
    done
fi