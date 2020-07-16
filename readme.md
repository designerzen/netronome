As close to time perfect as you can get in native javascript. *

It's important to keep in mind that to mitigate potential security threats such as Spectre, browsers typically round the returned value by some amount in order to be less predictable. This inherently introduces a degree of inaccuracy by limiting the resolution or precision of the timer. For example, Firefox rounds the returned time to 1 millisecond increments.

Hopefully if the github action is working the test page should also be available on my github pages url

* I really am tempted to try the same experiments using webASM